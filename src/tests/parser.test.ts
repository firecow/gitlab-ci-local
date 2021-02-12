import {Parser} from "../parser";
import * as fs from "fs";

test('include remote (project, ref, file)', async () => {
    if (fs.existsSync("src/tests/test-cases/plain/.gitlab-ci-local/includes/inkscape/inkscape/INKSCAPE_1_0_2/.gitlab-ci.yml")) {
        fs.unlinkSync("src/tests/test-cases/plain/.gitlab-ci-local/includes/inkscape/inkscape/INKSCAPE_1_0_2/.gitlab-ci.yml");
    }
    await Parser.downloadIncludeFile("src/tests/test-cases/plain", "inkscape/inkscape", "INKSCAPE_1_0_2", ".gitlab-ci.yml", 'gitlab.com');
    const exists = fs.existsSync("src/tests/test-cases/plain/.gitlab-ci-local/includes/inkscape/inkscape/INKSCAPE_1_0_2/.gitlab-ci.yml");
    expect(exists).toEqual(true);
});

test('include invalid remote (project, ref, file)', async () => {
    try {
        await Parser.downloadIncludeFile("src/tests/test-cases/plain", "inkscape/inkscape", "INVALID_TAG", ".gitlab-ci.yml", 'gitlab.com');
    } catch (e) {
        expect(e.message).toBe([
            "'git archive --remote=git@gitlab.com:inkscape/inkscape.git INVALID_TAG .gitlab-ci.yml | tar -xC .gitlab-ci-local/includes/inkscape/inkscape/INVALID_TAG/' exited with 2",
            "fatal: sent error to the client: git upload-archive: archiver died with error",
            "remote: fatal: no such ref: INVALID_TAG        ",
            "remote: git upload-archive: archiver died with error",
            "tar: This does not look like a tar archive",
            "tar: Exiting with failure status due to previous errors",
            ""
        ].join('\n'));
    }
});
