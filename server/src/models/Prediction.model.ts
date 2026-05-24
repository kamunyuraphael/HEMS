// Linear regression uotput and anomaly detection results stored in MongoDB for user access and historical analysis.
import { Schema, model, Document } from 'mongoose';

interface IPrediction extends Document {
    userId: Schema.Types.ObjectId; // Reference to User
    predictionDate: Date;
    forecastedBillKSH: number;
    confidenceInterval: {
        low: number;
        high: number;
    };
    detectedAnomalies: string[]; // List of anomaly descriptions
}

const predictionSchema = new Schema<IPrediction>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    predictionDate: { type: Date, default: Date.now },
    forecastedBillKSH: { type: Number, required: true },
    confidenceInterval: {
        low: { type: Number },
        high: { type: Number }
    },
    detectedAnomalies: [{ type: String }]
});

export const Prediction = model<IPrediction>('Prediction', predictionSchema);