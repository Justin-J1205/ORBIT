import { describe, expect, it } from "vitest";

import { formatAlertMessage } from "../../app/(app)/admin/lib/helpers";

describe("formatAlertMessage", () => {
  it("renders structured equipment markers as readable text", () => {
    expect(
      formatAlertMessage(
        'Equipment request received. [Equipment: {"items":["whiteboard","extra_chairs"],"others":null}]',
      ),
    ).toBe("Equipment request received. Equipment: whiteboard, extra chairs");
  });

  it("does not throw or alter an equipment marker with invalid JSON", () => {
    const message = 'Equipment request received. [Equipment: {"items":}]';

    expect(formatAlertMessage(message)).toBe(message);
  });
});
