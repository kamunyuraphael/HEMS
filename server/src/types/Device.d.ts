import { Types } from 'mongoose';

export interface IDevice {
    _id: Types.ObjectId;
    name: string;
    category: 'kitchen' | 'laundry' | 'lighting' | 'entertainment' | 'HVAC' | 'computing';
    status: 'active' | 'inactive';
    owner: Types.ObjectId; // User ID
    consumptionLogs: {
        date: Date;
        kWh: number;
    }[];
    createdAt?: Date;
    updatedAt?: Date;
}