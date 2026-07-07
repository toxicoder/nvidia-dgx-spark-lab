import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "../LoginForm";

const push = vi.fn();
const refresh = vi.fn();
const signInEmail = vi.fn();
let nextParam: string | null = "//evil.com";
let visualError: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === "next") return nextParam;
      if (key === "visual_error") return visualError;
      return null;
    }
  })
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmail(...args) }
  }
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextParam = "/dashboard";
    visualError = null;
    signInEmail.mockResolvedValue({ error: null });
  });

  it("renders email and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("shows visual error fixture from search params", () => {
    visualError = "1";
    render(<LoginForm />);
    expect(screen.getByText(/Invalid email or password \(visual fixture\)/)).toBeInTheDocument();
  });

  it("updates email and password on change", () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "admin@lab.local" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    expect(screen.getByLabelText(/email/i)).toHaveValue("admin@lab.local");
    expect(screen.getByLabelText(/password/i)).toHaveValue("secret");
  });

  it("redirects to home when next param is absent", async () => {
    nextParam = null;
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "admin@lab.local" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
  });

  it("signs in and redirects to safe next path", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "admin@lab.local" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith({ email: "admin@lab.local", password: "secret" });
      expect(push).toHaveBeenCalledWith("/dashboard");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("rejects unsafe next redirect", async () => {
    nextParam = "//evil.com";
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
  });

  it("shows sign-in error from auth client", async () => {
    signInEmail.mockResolvedValue({ error: { message: "Invalid credentials" } });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("shows generic error when sign-in error has no message", async () => {
    signInEmail.mockResolvedValue({ error: {} });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Sign in failed")).toBeInTheDocument();
    });
  });

  it("shows exception message on unexpected failure", async () => {
    signInEmail.mockRejectedValue(new Error("network down"));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("network down")).toBeInTheDocument();
    });
  });

  it("shows non-Error exception as string", async () => {
    signInEmail.mockRejectedValue("boom");
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
    });
  });

  it("shows loading state while signing in", async () => {
    let resolve!: (v: unknown) => void;
    signInEmail.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    resolve({ error: null });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign in/i })).not.toBeDisabled();
    });
  });
});
