// adapted from https://github.com/apideck-libraries/better-ajv-errors (MIT)
// https://github.com/apideck-libraries/better-ajv-errors/tree/026206038919c1fb73b4e8ef258a2e4a01813c4a

import {DefinedError, ErrorObject} from "ajv";
import pointer from "jsonpointer";

export interface ValidationError {
    message: string;
    path: string;
}

const QUOTES_REGEX = /"/g;
const NOT_REGEX = /NOT/g;
const SLASH_REGEX = /\//g;

const AJV_ERROR_KEYWORD_WEIGHT_MAP: Partial<Record<DefinedError["keyword"], number>> = {enum: 1, type: 0};

const pointerToDotNotation = (pointer: string): string => {
    return pointer.replace(SLASH_REGEX, ".");
};

const cleanAjvMessage = (message: string): string => {
    return message.replace(QUOTES_REGEX, "'").replace(NOT_REGEX, "not");
};

const getLastSegment = (path: string): string => {
    const segments = path.split("/");
    return segments.pop() as string;
};

const safeJsonPointer = <T>({object, pnter, fallback}: {object: any; pnter: string; fallback: T}): T => {
    try {
        return pointer.get(object, pnter) ?? fallback;
    } catch (err) {
        return fallback;
    }
};

const filterSingleErrorPerProperty = (errors: DefinedError[]): DefinedError[] => {
    const errorsPerProperty: Record<string, DefinedError> = {};
    errors.forEach(error => {
        const prop =
            error.instancePath + ((error.params as any)?.additionalProperty ?? (error.params as any)?.missingProperty ?? "");
        const existingError = errorsPerProperty[prop];
        if (!existingError) {
            errorsPerProperty[prop] = error;
            return errorsPerProperty;
        }

        const weight = AJV_ERROR_KEYWORD_WEIGHT_MAP[error.keyword] ?? 0;
        const existingWeight = AJV_ERROR_KEYWORD_WEIGHT_MAP[existingError.keyword] ?? 0;

        if (weight > existingWeight) {
            errorsPerProperty[prop] = error;
        }
    });

    return Object.values(errorsPerProperty);
};

interface BetterAjvErrorsOptions {
    errors: ErrorObject[] | null | undefined;
    data: any;
    basePath?: string;
}

export const betterAjvErrors = ({
    errors,
    data,
    basePath = "",
}: BetterAjvErrorsOptions): ValidationError[] => {
    if (!Array.isArray(errors) || !errors?.length) {
        return [];
    }

    const definedErrors = filterSingleErrorPerProperty(errors as DefinedError[]);

    return definedErrors.map((error) => {
        const path = basePath ? pointerToDotNotation(basePath + error.instancePath) : pointerToDotNotation(error.instancePath).substring(1);
        const prop = getLastSegment(error.instancePath);
        const propertyMessage = prop ? `property '${prop}'` : path;
        const defaultMessage = `${propertyMessage} ${(cleanAjvMessage(error.message as string))}`;

        let validationError: ValidationError;

        switch (error.keyword) {
            case "additionalProperties": {
                const additionalProp = error.params.additionalProperty;
                validationError = {
                    message: `'${additionalProp}' property is not expected to be here`,
                    path,
                };
                break;
            }
            case "enum": {
                const allowedValues = error.params.allowedValues.map((value) => value.toString());
                const prop = getLastSegment(error.instancePath);
                const value = safeJsonPointer({object: data, pnter: error.instancePath, fallback: ""});
                validationError = {
                    message: `'${prop}' property must be one of [${allowedValues.join(", ")}] (found ${value})`,
                    path,
                };
                break;
            }
            case "type": {
                const prop = getLastSegment(error.instancePath);
                const type = error.params.type;
                validationError = {
                    message: `'${prop}' property type must be ${type}`,
                    path,
                };
                break;
            }
            case "required": {
                validationError = {
                    message: `${path} must have required property '${error.params.missingProperty}'`,
                    path,
                };
                break;
            }
            case "const": {
                return {
                    message: `'${prop}' property must be equal to the allowed value`,
                    path,
                };
            }

            default:
                validationError = {message: defaultMessage, path};
        }

        // Remove empty properties
        const errorEntries = Object.entries(validationError);
        for (const [key, value] of errorEntries as [keyof ValidationError, unknown][]) {
            if (value === null || value === undefined || value === "") {
                delete validationError[key];
            }
        }

        return validationError;
    });
};

