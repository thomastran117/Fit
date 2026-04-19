import assert from "node:assert/strict";
import { ContentSanitizationService } from "@/features/security/content-sanitization.service";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const service = new ContentSanitizationService();

const tests: TestCase[] = [
  {
    name: "content sanitization accepts ordinary posting text",
    run: () => {
      const violations = service.inspect([
        {
          path: "description",
          value: "Bright two bedroom apartment with parking and in-suite laundry.",
        },
        {
          path: "tags.0",
          value: "pet-friendly",
        },
      ]);

      assert.deepEqual(violations, []);
    },
  },
  {
    name: "content sanitization rejects html and preserves the offending path",
    run: () => {
      const violations = service.inspect([
        {
          path: "description",
          value: "<script>alert('xss')</script>",
        },
      ]);

      assert.equal(violations.length, 1);
      assert.equal(violations[0]?.path, "description");
      assert.equal(violations[0]?.code, "UNSAFE_MARKUP");
    },
  },
  {
    name: "content sanitization rejects profanity",
    run: () => {
      const violations = service.inspect([
        {
          path: "name",
          value: "No shitty roommates please",
        },
      ]);

      assert.equal(violations.length, 1);
      assert.equal(violations[0]?.path, "name");
      assert.equal(violations[0]?.code, "PROFANITY");
    },
  },
  {
    name: "content sanitization rejects control characters",
    run: () => {
      const violations = service.inspect([
        {
          path: "availabilityNotes",
          value: "Available now\u0007",
        },
      ]);

      assert.equal(violations.length, 1);
      assert.equal(violations[0]?.path, "availabilityNotes");
      assert.equal(violations[0]?.code, "CONTROL_CHARACTER");
    },
  },
  {
    name: "content sanitization rejects obvious injection markers",
    run: () => {
      const violations = service.inspect([
        {
          path: "attributes.entryCode",
          value: "' OR 1=1 --",
        },
      ]);

      assert.equal(violations.length, 1);
      assert.equal(violations[0]?.path, "attributes.entryCode");
      assert.equal(violations[0]?.code, "INJECTION_PATTERN");
    },
  },
];

export async function runContentSanitizationTests(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`PASS ${test.name}`);
  }

  console.log(`Completed ${tests.length} content sanitization tests.`);
}

void runContentSanitizationTests().catch((error: unknown) => {
  console.error("Content sanitization tests failed.", error);
  process.exit(1);
});
