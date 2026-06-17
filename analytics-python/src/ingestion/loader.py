"""
loader.py - UK-DALE Dataset Ingestion Agent

Loads the aggregate (mains) and per-appliance power data from the UK-DALE
HDF5 dataset for a specified building using NILMTK. This is the entry point
of the Python analytics pipeline -- everything downstream (disaggregation,
forecasting, anomaly detection) consumes the Series returned here.

Requires the UK-DALE dataset converted to NILMTK's HDF5 format
(ukdale.h5), available from https://jack-kelly.com/data/
"""

import logging
from pathlib import Path
from typing import Optional

import pandas as pd
from nilmtk import DataSet

from config import Config

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class UKDALELoader:
    """Handles loading and basic extraction from the UK-DALE dataset."""

    def __init__(self, data_path: Optional[str] = None, building_id: Optional[int] = None):
        self.data_path = data_path or Config.UKDALE_PATH
        self.building_id = building_id or Config.BUILDING_ID
        self.dataset: Optional[DataSet] = None
        self.elec = None

        if not Path(self.data_path).exists():
            raise FileNotFoundError(
                f"UK-DALE dataset not found at '{self.data_path}'. "
                "Download ukdale.h5 from https://jack-kelly.com/data/ "
                "and place it in the data/ directory."
            )

    def load(self) -> None:
        """Load the dataset and select the target building's electric meters."""
        logger.info(f"Loading UK-DALE dataset from {self.data_path}")
        self.dataset = DataSet(self.data_path)

        if self.building_id not in self.dataset.buildings:
            available = list(self.dataset.buildings.keys())
            raise ValueError(
                f"Building {self.building_id} not found. Available buildings: {available}"
            )

        self.elec = self.dataset.buildings[self.building_id].elec
        n_appliances = len(self.elec.submeters().meters)
        logger.info(f"Loaded Building {self.building_id} with {n_appliances} submetered appliances")

    def set_window(self, start: Optional[str] = None, end: Optional[str] = None) -> None:
        """
        Restrict the dataset's time window before extracting data.

        Args:
            start: ISO date string, e.g. '2013-04-12'.
            end: ISO date string, e.g. '2013-04-13'.
        """
        if self.dataset is None:
            raise RuntimeError("Call load() before set_window().")

        self.dataset.set_window(start=start, end=end)
        logger.info(f"Time window set: start={start}, end={end}")

    def get_mains_power(self, sample_period: Optional[int] = None) -> pd.Series:
        """
        Return the whole-house aggregate (mains) active power series.

        Args:
            sample_period: Resample period in seconds. Defaults to Config.SAMPLE_PERIOD.

        Returns:
            pandas Series indexed by timestamp (UTC), values in Watts.
        """
        if self.elec is None:
            raise RuntimeError("Call load() before get_mains_power().")

        period = sample_period or Config.SAMPLE_PERIOD
        mains = self.elec.mains()

        logger.info(f"Loading mains power at {period}s resolution")
        power_series = next(mains.power_series(sample_period=period))
        power_series.name = "mains_watts"
        return power_series

    def get_appliance_power(self, appliance_name: str, sample_period: Optional[int] = None) -> pd.Series:
        """
        Return the power series for a single appliance.

        Args:
            appliance_name: NILMTK appliance label, e.g. 'kettle', 'fridge', 'washing machine'.
            sample_period: Resample period in seconds. Defaults to Config.SAMPLE_PERIOD.

        Returns:
            pandas Series indexed by timestamp (UTC), values in Watts.
        """
        if self.elec is None:
            raise RuntimeError("Call load() before get_appliance_power().")

        period = sample_period or Config.SAMPLE_PERIOD
        meter = self.elec[appliance_name]

        logger.info(f"Loading '{appliance_name}' power at {period}s resolution")
        power_series = next(meter.power_series(sample_period=period))
        power_series.name = appliance_name.replace(" ", "_")
        return power_series

    def get_all_appliance_power(self, sample_period: Optional[int] = None) -> pd.DataFrame:
        """
        Return a single DataFrame combining mains + every submetered appliance,
        aligned on a shared timestamp index. Missing readings are forward-filled
        then any remaining gaps are dropped.

        Args:
            sample_period: Resample period in seconds. Defaults to Config.SAMPLE_PERIOD.

        Returns:
            pandas DataFrame, one column per meter, indexed by timestamp.
        """
        period = sample_period or Config.SAMPLE_PERIOD

        series_list = [self.get_mains_power(period)]
        for appliance in self.list_appliances():
            try:
                series_list.append(self.get_appliance_power(appliance, period))
            except Exception as exc:
                logger.warning(f"Skipping '{appliance}': {exc}")

        df = pd.concat(series_list, axis=1)
        df = df.ffill().dropna()
        return df

    def list_appliances(self) -> list[str]:
        """Return the list of appliance labels available for this building."""
        if self.elec is None:
            raise RuntimeError("Call load() before list_appliances().")

        return [meter.label() for meter in self.elec.submeters().meters]

    def close(self) -> None:
        """Release the underlying HDF5 file handle."""
        if self.dataset is not None:
            self.dataset.store.close()
            logger.info("Dataset store closed")


if __name__ == "__main__":
    loader = UKDALELoader()
    loader.load()

    print("Available appliances:")
    for appliance in loader.list_appliances():
        print(f"  - {appliance}")

    # Restrict to a single day for a quick smoke test
    loader.set_window(start="2013-04-12", end="2013-04-13")

    mains_power = loader.get_mains_power()
    print(f"\nMains power sample ({len(mains_power)} readings):")
    print(mains_power.head())

    loader.close()