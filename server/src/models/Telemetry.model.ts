// 10s interval aggregate/disaggregated telemetry data stored in MongoDB for historical analysis and ML model training.
import { Schema, model, Document } from 'mongoose';

// Interface for type safety
interface ITelemtry extends Document {
    timestamp: Date;
    aggregateLoad: number; // in Watts
    disaggregatedLoads: {
        kitchen: number;
        loundry: number;
        entertainment: number;
        computing: number;
    };
}

// Schema defifnition 
const telemetrySchema = new Schema<ITelemtry>({
    timestamp: {
        type: Date, required: true, index: true // indexed fro time series performance
    },
    aggregateLoad: { type: Number, required: true },
    disaggregatedLoads: {
        kitchen: { type: Number, default: 0 },
        loundry: { type: Number, default: 0 },
        entertainment: { type: Number, default: 0 },
        computing: { type: Number, default: 0 }
    }
});

export const Telemetry = model<ITelemtry>('Telemetry', telemetrySchema);