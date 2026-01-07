import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import MemberForm from "../MemberForm";
import type { User } from "@supabase/supabase-js";

// Mock Supabase client
vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      upsert: vi.fn(() => ({
        onConflict: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
} as User;

describe("MemberForm", () => {
  it("renders form fields correctly", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemberForm user={mockUser} />
      </QueryClientProvider>
    );

    // Wait for form to load (since we have async data fetching)
    await waitFor(() => {
        expect(screen.getByText("Personal Data")).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Surname/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Given Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/IBAN/i)).toBeInTheDocument();
  });
});
