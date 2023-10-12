import {
    ApiResponseCode,
    FlagModel,
    ApiResponseCodes,
    dateHelper,
} from "@switchfeat/core";
import { ConditionModel, StringOperator } from "@switchfeat/core";
import { v4 as uuidv4 } from "uuid";

export type EvaluateResponse = {
    match: boolean;
    datetimeMatch: boolean; 
    meta: {
        segment: string | null;
        condition: string | null;
    };
    reason: ApiResponseCode;
    time: number;
    correlationId: string;
    responseId: string;
};

export const evaluateFlag = async (
    flag: FlagModel,
    context: Record<string, string>,
    correlationId: string,
): Promise<EvaluateResponse> => {
    const response: EvaluateResponse = {
        match: false,
        datetimeMatch: false, 
        meta: {},
    } as EvaluateResponse;
    const startTime = dateHelper.utcNow();
    try {
        if (!flag.rules) {
            response.match = flag.status;
            response.reason = ApiResponseCodes.RuleNotFound;
            return response;
        }

        const firstContextKey = Object.keys context[0];
        const contextValue = context[firstContextKey];

        if (!flag.status) {
            response.reason = ApiResponseCodes.FlagDisabled;
            return response;
        }

        let foundMatchCondition = false;
        flag.rules.map((x) => {
            if (!foundMatchCondition) {
                const conditions = x.segment.conditions;
                const matchCondition = conditions?.filter(
                    (y) => y.context === firstContextKey,
                )[0];
                if (matchCondition) {
                    const hasMatch = getMatchByCondition(
                        matchCondition,
                        contextValue,
                    );
                    response.match = hasMatch;
                    response.meta.segment = x.segment.key;
                    response.meta.condition = matchCondition.key;
                    foundMatchCondition = true;
                    response.reason = ApiResponseCodes.FlagMatch;
                }
                const datetimeMatchCondition = conditions?.filter((y) => y.context === firstContextKey && y.conditionType === 'datetime')[0];
                if (datetimeMatchCondition) {
                    const hasDatetimeMatch = checkDatetimeMatchCondition(datetimeMatchCondition, contextValue);
                    response.datetimeMatch = hasDatetimeMatch;
                }
            }
        });

        if (!foundMatchCondition) {
            response.reason = ApiResponseCodes.NoMatchingCondition;
            return response;
        }
    } catch (ex) {
        response.reason = ApiResponseCodes.GenericError;
    } finally {
        response.time = dateHelper.diffInMs(startTime, dateHelper.utcNow())!;
        response.responseId = uuidv4();
        response.correlationId = correlationId;
    }

    return response;
};

const getMatchByCondition = (
    condition: ConditionModel,
    contextValue: string,
): boolean => {
    switch (condition.conditionType) {
        case "string": {
            return stringConditionMatcher(condition, contextValue);
        }
        case "datetime": {
            return datetimeConditionMatcher(condition, contextValue);
        }
    }

    return false;
};

const stringConditionMatcher = (
    condition: ConditionModel,
    contextValue: string,
): boolean => {
    switch (condition.operator as StringOperator) {
        case "equals": {
            return contextValue === condition.value;
        }
    }

    return false;
};

const datetimeConditionMatcher = (
    condition: ConditionModel,
    contextValue: string,
): boolean => {
    const contextDateTime = new Date(contextValue);
    const conditionDateTime = new Date(condition.value);

    switch (condition.operator) {
        case "before": {
            return contextDateTime < conditionDateTime;
        }
        case "after": {
            return contextDateTime > conditionDateTime;
        }
        case "beforeOrAt": {
            return contextDateTime <= conditionDateTime;
        }
        case "afterOrAt": {
            return contextDateTime >= conditionDateTime;
        }
        case "equals": {
            return contextDateTime.getTime() === conditionDateTime.getTime();
        }
        case "notEquals": {
            return contextDateTime.getTime() !== conditionDateTime.getTime();
        }
    }

    return false;
};

const checkDatetimeMatchCondition = (
    condition: ConditionModel,
    contextValue: string
): boolean => {
    const contextDateTime = new Date(contextValue);
    const conditionDateTime = new Date(condition.value);
    return contextDateTime < conditionDateTime;
};
