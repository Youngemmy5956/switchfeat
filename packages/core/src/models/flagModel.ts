import { DateTime } from 'luxon';
import { ConditionModel } from './conditionModel';
import { ObjectId } from 'mongodb';

export interface FlagModel {
    id?: ObjectId,
    name: string;
    description?: string;
    createdOn: DateTime;
    updatedOn: DateTime;
    status: boolean;
    condition: ConditionModel;
}