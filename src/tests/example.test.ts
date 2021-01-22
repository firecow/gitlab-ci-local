import * as defaultCmd from "../default_cmd";

// import * as mockProcess from "jest-mock-process";

test('docker-compose example', async() => {
    jest.setTimeout(45000);
    // const mockProcessExit = mockProcess.mockProcessExit();
    await defaultCmd.handler({
        cwd: 'examples/docker-compose-nodejs',
    });
    // expect(mockProcessExit).toHaveBeenCalledWith(0);
    // mockProcessExit.mockRestore();
});
