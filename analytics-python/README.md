```
    analytics-python/
    ├── data/                        # UK-DALE dataset files (.h5)
    ├── models/                      # Saved trained models (.pkl)
    ├── src/
    │   ├── ingestion/
    │   │   └── loader.py            # Load UK-DALE Building 1 via NILMTK
    │   ├── pipeline/
    │   │   ├── disaggregator.py     # NILMTK CO/FHMM disaggregation
    │   │   ├── forecaster.py        # Scikit-learn consumption regression
    │   │   └── anomaly.py           # Anomaly detection (IsolationForest)
    │   ├── bridge/
    │   │   └── poster.py            # HTTP POST to Node /api/ml/predictions
    │   └── scheduler.py             # APScheduler cron runner
    ├── app.py                       # Flask entry point + /health + /run
    ├── config.py                    # Env vars, building ID, intervals
    └── requirements.txt
```
The flow per scheduled run:
#### *loader.py → disaggregator.py → forecaster.py → anomaly.py → poster.py → Node API*

Three prediction types that map directly to the Node schema:

- consumption - per-appliance kWh forecast from the regression model
- anomaly - flagged readings from IsolationForest with anomalyDetails
- bill - projected monthly cost computed from forecasted kWh

This means every POST from Python slots straight into the mlPredictionSchema with no Node changes needed.

### Requirements.txt
-These are the analytics dependencies needed for the pyhon ochestron layer.

```
flask
numpy
pandas
scikit-learn
requests
nilmtk
apscheduler
python-dotenv
```

### Loader.py(ingestion/loader.py)
*UKDALELoader.get_mains_power()* uses *next(mains.power_series(...))* - NILMTK's *power_series()* returns a generator (it can yield in chunks for huge datasets), so *next()* grabs the first chunk. For Building 1's full multi-year mains data this could be large; *set_window()* lets you slice to a manageable date range before pulling data, which you'll want for both training and your scheduled ingestion runs.
*get_all_appliance_power()* is the method disaggregator and forecaster will likely call most — it gives you one aligned DataFrame with mains + every appliance channel, ready for scikit-learn. Appliances with missing or corrupted channels are skipped with a warning rather than crashing the whole load.
Sample period of 6s matches UK-DALE's appliance submeter rate (1/6 Hz), so mains gets downsampled to meet appliances rather than upsampling appliances to 1Hz (which would just duplicate values).

### Disaggregator(disaggregator.py)
The disaggregator is the core of NILM - it takes the aggregate mains signal and tries to separate out individual appliance contributions.
CO (Combinatorial Optimisation) is the right algorithm to start with for UK-DALE - it's well validated on this dataset and more interpretable than FHMM for a first implementation.
Training window matters a lot for CO. April 2013 is a good starting month for Building 1 - it has clean, continuous data. The model learns each appliance's typical on/off power states from the ground-truth submeter readings during that window. A full month gives it enough on/off cycles per appliance to learn reliable state clusters.
*to_prediction_payloads()* is what bridges to Node backend. It outputs exactly the structure mlPredictionSchema expects — userId, type: "consumption", predictedValue in kWh, confidence, and targetDate. 
*confidence: 0.75* is a fixed value for CO because the algorithm gives point estimates with no probabilistic output. The forecaster.py will derive actual confidence scores from the regression model's R² or prediction intervals.
One thing to watch when you run the smoke test - training on a full month of 6s data is computationally heavy. If it's too slow on your machine, narrow the training window to "2013-04-01" → "2013-04-07" for testing.

### Forecaster(forecaster.py)
The forecaster uses scikit-learn to predict future consumption - it takes the disaggregated per-appliance power data from the disaggregator as its input features and predicts kWh for a future target date.

### Anomaly(anomaly.py)
The anomaly detector uses scikit-learn's IsolationForest - it's well suited for energy data because it doesn't require labelled anomalies to train on, it learns what "normal" consumption looks like and flags deviations.
Two detection layers. Whole-home anomalies catch things like a heating system running overnight unexpectedly, or a power surge. Per-appliance anomalies catch things like a fridge compressor running 80% of the hour instead of its normal 30% - which could indicate a failing seal or door left open.
_score_to_confidence() maps IsolationForest's decision function output directly to your API's confidence field. A score of -0.5 (maximally anomalous) maps to 0.99 confidence; a borderline -0.05 maps to 0.549. This gives your frontend meaningful signal strength to display.
anomalyDetails strings are human-readable and structured - your Socket.io alert on the frontend can display them directly to the user without any transformation.
CONTAMINATION = 0.05 means the model expects roughly 5% of readings to be anomalous during training. If Building 1 has genuinely unusual usage patterns during your training window, you may need to tune this down to 0.02 to avoid over-flagging.

### Poster(poster.py)
The poster is the REST bridge - it takes the payloads from all three pipeline modules and delivers them to the Node backend.
Two retry layers working together. urllib3's Retry handles low-level transport failures (connection refused, 502/503/504). The post_payload() recursive retry handles application-level failures (500, timeouts). They don't overlap - urllib3 fires before the response reaches our code, our retry fires after.
401 and 400 don't retry. A 401 means the ML_API_KEY is wrong - retrying won't fix that. A 400 means the payload failed Zod schema validation on the Node side - retrying the same malformed payload is pointless. Both log a clear error and return immediately.
post_pipeline_results() is what scheduler.py will call - one function that fires all three module batches in sequence and returns a combined summary. If the anomaly batch fails entirely, disaggregation and forecast results are already safely posted.
Module-level session reuse means one TCP connection pool is shared across all POSTs in a scheduler run rather than opening a new connection per payload - important when posting 50+ payloads per pipeline run.
The check_node_health() call in scheduler.py will gate every pipeline run - if Node is down, Python skips the run entirely rather than queuing up hundreds of failed POSTs.

### Scheduler(scheduler.py)
The scheduler is the orchestrator - it wires all four modules together and runs the full pipeline on a cron interval. 
max_instances=1 prevents overlapping pipeline runs  if a run takes longer than the interval (likely during a heavy disaggregation), APScheduler won't fire a second instance on top of it.
timezone="Africa/Nairobi" sets the scheduler's timezone correctly for Kenya (EAT, UTC+3) so cron expressions and logs reflect local time.
Auto-retrain every 7 days keeps the models fresh without manual intervention. The _should_retrain() check runs at the start of every pipeline tick - cheap to evaluate, only triggers the expensive retrain when due.
Fixed UK-DALE dates (ukdale_window_start, ukdale_window_end) are used because UK-DALE is a historical dataset. Once you integrate live IoT sensor data into the pipeline, replace those with datetime.now() based windows and they'll naturally slide forward in real time.
DEFAULT_USER_ID is a placeholder ObjectId. Once the frontend auth flow is wired up, you'll want to either pull active user IDs from MongoDB directly or pass them in from an environment variable per deployment.

### App(app.py)
app.py is the Flask entry point - it exposes HTTP endpoints so the Node server can also trigger or query the pipeline on demand, alongside the scheduler running in the background.
