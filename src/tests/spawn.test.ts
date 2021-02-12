import {Utils} from "../utils";

// test('Spawn successful command', async() => {
//     const res = await Utils.spawn('echo "Hello, world!"');
//     expect(res.stdout).toBe("Hello, world!");
//     expect(res.stderr).toBe("");
//     expect(res.status).toBe(0);
// });


test('Spawn bad exit', async () => {
    try {
        await Utils.spawn('bad command');
    } catch (e) {
        expect(e.message).toBe("'bad command' exited with 127\nbash: bad: command not found\n")
    }
});
