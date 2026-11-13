import { describe, expect, it } from "vitest";

import { getEquipmentItemNames } from "../../shared/equipmentFormatting";

describe("equipment item formatting", () => {
  it("uses names from equipment arrays instead of their numeric indexes", () => {
    expect(getEquipmentItemNames(["projector", "whiteboard"])).toEqual(["projector", "whiteboard"]);
  });

  it("reads items arrays and object keys while excluding notes and false values", () => {
    expect(getEquipmentItemNames({ items: ["hdmi"], others: "Adapter needed" })).toEqual(["hdmi"]);
    expect(getEquipmentItemNames({ projector: true, whiteboard: true, microphone: false, others: "Notes" }))
      .toEqual(["projector", "whiteboard"]);
  });
});
