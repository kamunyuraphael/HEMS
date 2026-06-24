"""
disaggregator.py - NILMTK Combinatorial Optimisation Disaggregation Pipeline

Takes the aggregate mains power signal from UK-DALE Building 1 and
disaggregates it into per-appliance power estimates using NILMTK's
CO (Combinatorial Optimisation) algorithm.

CO works by:
  1. Learning the on/off power states for each appliance from ground-truth
     submeter data during a training window.
  2. At inference time, finding the combination of appliance states whose
     sum best matches the observed aggregate reading at each timestep.

This is the most interpretable NILM algorithm and well-validated on UK-DALE.
"""

import logging
import pickle
from pathlib import Path
from typing import Optional

import pandas as pd
from nilmtk import DataSet
from nilmtk.disaggregate import CO

from config import Config
from ingestion.loader import UKDALELoader

logger = logging.getLogger(__name__)

# Appliances we target for disaggregation.
# Chosen based on Building 1 availability and energy significance.
# Lights are excluded here — their multiplicity and low wattage make
# them better handled as a grouped "lighting" aggregate.
TARGET_APPLIANCES = [
    "kettle",
    "fridge freezer",
    "washing machine",
    "dish washer",
    "microwave",
    "television",
    "toaster",
    "oven",
    "computer",
    "desktop computer",
    "laptop computer",
    "boiler",
]

MODEL_SAVE_PATH = Path("models/co_model.pkl")


class EnergyDisaggregator:
    """
    Wraps NILMTK's CO disaggregator with training, inference,
    persistence, and structured output for the analytics pipeline.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = Path(model_path) if model_path else MODEL_SAVE_PATH
        self.co = CO()
        self._trained = False

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(
        self,
        train_start: str = "2013-04-01",
        train_end: str = "2013-04-30",
    ) -> None:
        """
        Train the CO model on a window of UK-DALE Building 1 ground-truth data.

        Args:
            train_start: ISO date string for the start of the training window.
            train_end:   ISO date string for the end of the training window.
        """
        logger.info(f"Training CO disaggregator on {train_start} → {train_end}")

        loader = UKDALELoader()
        loader.load()
        loader.set_window(start=train_start, end=train_end)

        elec = loader.dataset.buildings[Config.BUILDING_ID].elec

        # NILMTK's train() expects the full ElecMeter object, not raw Series.
        # It will internally access submeters for the appliances it can find.
        self.co.train(elec, sample_period=Config.SAMPLE_PERIOD)
        self._trained = True

        loader.close()
        logger.info("CO model training complete")
        self.save_model()

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def disaggregate(
        self,
        test_start: str,
        test_end: str,
    ) -> pd.DataFrame:
        """
        Run disaggregation over a given time window and return per-appliance
        power estimates as a DataFrame.

        Args:
            test_start: ISO date string for the start of the inference window.
            test_end:   ISO date string for the end of the inference window.

        Returns:
            DataFrame with columns per appliance, indexed by timestamp.
            Values are estimated power in Watts.
        """
        if not self._trained:
            raise RuntimeError("Model is not trained. Call train() or load_model() first.")

        logger.info(f"Running CO disaggregation on {test_start} → {test_end}")

        loader = UKDALELoader()
        loader.load()
        loader.set_window(start=test_start, end=test_end)

        elec = loader.dataset.buildings[Config.BUILDING_ID].elec

        # CO.disaggregate_chunk() returns a dict of {appliance_label: Series}
        result_df = self.co.disaggregate_chunk(
            elec.mains(),
            sample_period=Config.SAMPLE_PERIOD,
        )

        loader.close()

        result_df = self._clean_result(result_df)
        logger.info(f"Disaggregation complete: {result_df.shape[1]} appliances, {len(result_df)} timesteps")
        return result_df

    # ------------------------------------------------------------------
    # Post-processing
    # ------------------------------------------------------------------

    def compute_energy_per_appliance(self, power_df: pd.DataFrame) -> pd.Series:
        """
        Convert a power-over-time DataFrame (Watts) to total energy consumed
        per appliance (kWh) over the window.

        Energy (kWh) = mean_power (W) × duration (hours) / 1000

        Args:
            power_df: DataFrame from disaggregate(), Watts per timestep.

        Returns:
            Series indexed by appliance name, values in kWh.
        """
        if power_df.empty:
            return pd.Series(dtype=float)

        duration_hours = (
            (power_df.index[-1] - power_df.index[0]).total_seconds() / 3600
        )

        # Mean power × duration gives energy for each appliance
        energy_kwh = (power_df.mean() * duration_hours) / 1000.0
        energy_kwh.name = "kWh"
        return energy_kwh.round(4)

    def to_prediction_payloads(
        self,
        energy_series: pd.Series,
        user_id: str,
        target_date: str,
        device_map: Optional[dict[str, str]] = None,
    ) -> list[dict]:
        """
        Convert per-appliance kWh values into the JSON payload structure
        expected by the Node.js /api/ml/predictions endpoint.

        Args:
            energy_series: Output of compute_energy_per_appliance().
            user_id:       MongoDB ObjectId string of the authenticated user.
            target_date:   ISO date string the prediction applies to.
            device_map:    Optional dict mapping appliance label → MongoDB device _id.
                           Appliances not in the map are posted without a device field.

        Returns:
            List of prediction payload dicts, one per appliance.
        """
        payloads = []

        for appliance, kwh in energy_series.items():
            if kwh <= 0:
                continue  # skip appliances estimated as off for the entire window

            payload: dict = {
                "userId": user_id,
                "type": "consumption",
                "predictedValue": float(kwh),
                "confidence": 0.75,  # CO gives point estimates, not probabilities
                "targetDate": target_date,
                "anomalyDetails": None,
            }

            if device_map and appliance in device_map:
                payload["device"] = device_map[appliance]

            payloads.append(payload)

        return payloads

    # ------------------------------------------------------------------
    # Model persistence
    # ------------------------------------------------------------------

    def save_model(self) -> None:
        """Pickle the trained CO model to disk for reuse between runs."""
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump(self.co, f)
        logger.info(f"CO model saved to {self.model_path}")

    def load_model(self) -> None:
        """Load a previously trained CO model from disk."""
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"No saved model found at {self.model_path}. Run train() first."
            )
        with open(self.model_path, "rb") as f:
            self.co = pickle.load(f)
        self._trained = True
        logger.info(f"CO model loaded from {self.model_path}")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _clean_result(self, result_df: pd.DataFrame) -> pd.DataFrame:
        """
        Sanitise the raw CO output:
          - Clip negative power estimates to zero (CO occasionally produces
            small negative values due to rounding in the optimisation).
          - Forward-fill any NaN gaps introduced by the resampling alignment.
          - Drop any all-zero appliance columns (appliance never activated).
        """
        result_df = result_df.clip(lower=0)
        result_df = result_df.ffill().fillna(0)

        # Drop appliances with zero estimated consumption across the window
        active_cols = result_df.columns[result_df.sum() > 0].tolist()
        dropped = len(result_df.columns) - len(active_cols)
        if dropped:
            logger.info(f"Dropped {dropped} all-zero appliance column(s)")

        return result_df[active_cols]


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    disaggregator = EnergyDisaggregator()

    # Train on April 2013, test on a single day
    disaggregator.train(train_start="2013-04-01", train_end="2013-04-30")

    power_df = disaggregator.disaggregate(
        test_start="2013-05-01",
        test_end="2013-05-02",
    )

    print("\nPer-appliance power estimates (first 5 rows):")
    print(power_df.head())

    energy = disaggregator.compute_energy_per_appliance(power_df)
    print("\nEnergy consumed per appliance (kWh):")
    print(energy.sort_values(ascending=False))

    payloads = disaggregator.to_prediction_payloads(
        energy_series=energy,
        user_id="000000000000000000000001",  # placeholder ObjectId
        target_date="2013-05-01",
    )
    print(f"\nGenerated {len(payloads)} prediction payloads")
    print("Sample payload:", payloads[0] if payloads else "none")