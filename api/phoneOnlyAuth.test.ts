import { it, expect } from "vitest";
import { authRouter } from "./authRouter";
it("does not permit email authentication even when a legacy environment flag is set", async () => {
  const previous = process.env.ALLOW_EMAIL_SIGNUP;
  process.env.ALLOW_EMAIL_SIGNUP = "true";
  try {
    const client = authRouter.createCaller({
      req: new Request("http://localhost"),
      resHeaders: new Headers(),
    });
    const credentials = {
      email: "test@example.test",
      password: "not-a-real-password",
    };
    await expect(client.login(credentials)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      client.register({ ...credentials, name: "Test", username: "test_user" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  } finally {
    if (previous === undefined) delete process.env.ALLOW_EMAIL_SIGNUP;
    else process.env.ALLOW_EMAIL_SIGNUP = previous;
  }
});
