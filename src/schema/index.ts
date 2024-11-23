/* eslint-disable @typescript-eslint/ban-ts-comment */
import {schema} from "./schema.js";

// @ts-ignore
schema.definitions.job_template.properties.gclInjectSSHAgent = {
    "type": "boolean",
};
// @ts-ignore
schema.definitions.job_template.properties.gclInteractive = {
    "type": "boolean",
};
// @ts-ignore
schema.definitions.job_template.properties.gclArtifactsToSource = {
    "type": "boolean",
};
// @ts-ignore
schema.definitions.job_template.properties.gclDescription = {
    "type": "string",
};

export default schema;
