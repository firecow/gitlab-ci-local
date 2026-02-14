import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy, initSpawnSpyReject} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

describe("dependency-proxy", () => {
    beforeEach(() => {
        initSpawnSpy(WhenStatics.all);
    });

    describe("dependency proxy server not authenticated", () => {
        test("podman", async () => {

            initSpawnSpyReject([
                {
                    cmdArgs: "podman login gitlab.com:443".split(" "),
                    rejection: {
                        stderr: "Username: Error: getting username and password: reading username: EOF",
                    },
                },
            ]);

            try {
                const writeStreams = new WriteStreamsMock();

                await handler({
                    cwd: "tests/test-cases/dependency-proxy",
                    containerExecutable: "podman",
                }, writeStreams);

            } catch (e: any) {
                expect(e.message).toEqual("Please authenticate to the Dependency Proxy (gitlab.com:443) https://docs.gitlab.com/ee/user/packages/dependency_proxy/#authenticate-with-the-dependency-proxy");
                return;
            }
            throw new Error("Error is expected but not thrown/caught");
        });

        test("docker", async () => {

            initSpawnSpyReject([
                {
                    cmdArgs: "docker login gitlab.com:443".split(" "),
                    rejection: {
                        stderr: "Cannot perform an interactive login from a non TTY device",
                    },
                },
            ]);

            try {
                const writeStreams = new WriteStreamsMock();
                await handler({
                    cwd: "tests/test-cases/dependency-proxy",
                }, writeStreams);

            } catch (e: any) {
                expect(e.message).toEqual("Please authenticate to the Dependency Proxy (gitlab.com:443) https://docs.gitlab.com/ee/user/packages/dependency_proxy/#authenticate-with-the-dependency-proxy");
                return;
            }
            throw new Error("Error is expected but not thrown/caught");
        });
    });

    test("should attempt to pull the correct image", async () => {
        const writeStreams = new WriteStreamsMock();

        const ciDependencyProxyServerAuthenticated = {
            cmdArgs: "docker login gitlab.com:443".split(" "),
            returnValue: "Login Succeeded",
        };
        initSpawnSpy([ciDependencyProxyServerAuthenticated]);

        try {
            await handler({
                cwd: "tests/test-cases/dependency-proxy",
            }, writeStreams);
        } catch (e: any) {
            // In ci environment, gitlab.com:443 is not authenticated, but at least this shows that we're pulling from the correct path
            expect(e.shortMessage).toEqual("Command failed with exit code 1: docker pull gitlab.com:443/gcl/dependency_proxy/containers/busybox:latest");
            return;
        }
        throw new Error("Error is expected but not thrown/caught");

    });

});
