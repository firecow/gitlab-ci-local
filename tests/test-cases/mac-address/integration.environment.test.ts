import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});


const macAddress = "aa:bb:cc:dd:ee:ff";
test("mac-address", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/mac-address",
        containerMacAddress: macAddress,
    }, writeStreams);

    const expected = [
        chalk`{blueBright job} {green $ ip -o link show eth0 | awk '\{print $12\}'}`,
        chalk`{blueBright job} {greenBright >} ${macAddress}`,
    ];

    expect(writeStreams.stdoutLines.join("\n")).toContain(expected.join("\n"));
});
