import assert from "node:assert/strict";
import {
  createRootContainer,
  createServiceToken,
} from "@/configuration/bootstrap/container";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [
  {
    name: "singleton registrations resolve once per root container",
    run: () => {
      const container = createRootContainer();
      const singletonToken = createServiceToken<{ id: number }>("singleton");
      let created = 0;

      container.register({
        token: singletonToken,
        lifetime: "singleton",
        dependencies: [],
        resolve: () => ({ id: ++created }),
      });

      container.validate();

      const first = container.resolve(singletonToken);
      const second = container.resolve(singletonToken);

      assert.equal(created, 1);
      assert.equal(first, second);
    },
  },
  {
    name: "scoped registrations are reused within a scope and isolated across scopes",
    run: () => {
      const container = createRootContainer();
      const scopedToken = createServiceToken<{ id: number }>("scoped");
      let created = 0;

      container.register({
        token: scopedToken,
        lifetime: "scoped",
        dependencies: [],
        resolve: () => ({ id: ++created }),
      });

      container.validate();

      const scopeOne = container.createScope();
      const scopeTwo = container.createScope();
      const first = scopeOne.resolve(scopedToken);
      const second = scopeOne.resolve(scopedToken);
      const third = scopeTwo.resolve(scopedToken);

      assert.equal(first, second);
      assert.notEqual(first, third);
      assert.equal(created, 2);
    },
  },
  {
    name: "transient registrations resolve a fresh instance every time",
    run: () => {
      const container = createRootContainer();
      const transientToken = createServiceToken<{ id: number }>("transient");
      let created = 0;

      container.register({
        token: transientToken,
        lifetime: "transient",
        dependencies: [],
        resolve: () => ({ id: ++created }),
      });

      container.validate();

      const first = container.resolve(transientToken);
      const second = container.resolve(transientToken);

      assert.notEqual(first, second);
      assert.equal(created, 2);
    },
  },
  {
    name: "bootstrap validation fails when a dependency registration is missing",
    run: () => {
      const container = createRootContainer();
      const missingToken = createServiceToken<object>("missing");
      const dependentToken = createServiceToken<object>("dependent");

      container.register({
        token: dependentToken,
        lifetime: "singleton",
        dependencies: [missingToken],
        resolve: () => ({}),
      });

      assert.throws(() => container.validate(), /dependent -> missing missing/);
    },
  },
  {
    name: "bootstrap validation fails on a direct cycle",
    run: () => {
      const container = createRootContainer();
      const alphaToken = createServiceToken<object>("alpha");
      const betaToken = createServiceToken<object>("beta");

      container.register({
        token: alphaToken,
        lifetime: "singleton",
        dependencies: [betaToken],
        resolve: () => ({}),
      });
      container.register({
        token: betaToken,
        lifetime: "singleton",
        dependencies: [alphaToken],
        resolve: () => ({}),
      });

      assert.throws(() => container.validate(), /alpha -> beta -> alpha/);
    },
  },
  {
    name: "bootstrap validation fails on an indirect cycle",
    run: () => {
      const container = createRootContainer();
      const alphaToken = createServiceToken<object>("alpha");
      const betaToken = createServiceToken<object>("beta");
      const gammaToken = createServiceToken<object>("gamma");

      container.register({
        token: alphaToken,
        lifetime: "singleton",
        dependencies: [betaToken],
        resolve: () => ({}),
      });
      container.register({
        token: betaToken,
        lifetime: "singleton",
        dependencies: [gammaToken],
        resolve: () => ({}),
      });
      container.register({
        token: gammaToken,
        lifetime: "singleton",
        dependencies: [alphaToken],
        resolve: () => ({}),
      });

      assert.throws(() => container.validate(), /alpha -> beta -> gamma -> alpha/);
    },
  },
  {
    name: "acyclic graphs validate with mixed lifetimes",
    run: () => {
      const container = createRootContainer();
      const singletonToken = createServiceToken<{ kind: string }>("singleton");
      const scopedToken = createServiceToken<{ kind: string }>("scoped");
      const transientToken = createServiceToken<{ kind: string }>("transient");

      container.register({
        token: singletonToken,
        lifetime: "singleton",
        dependencies: [],
        resolve: () => ({ kind: "singleton" }),
      });
      container.register({
        token: scopedToken,
        lifetime: "scoped",
        dependencies: [singletonToken],
        resolve: ({ resolve }) => ({ kind: resolve(singletonToken).kind }),
      });
      container.register({
        token: transientToken,
        lifetime: "transient",
        dependencies: [scopedToken],
        resolve: ({ resolve }) => ({ kind: resolve(scopedToken).kind }),
      });

      assert.doesNotThrow(() => container.validate());
    },
  },
];

async function main(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`PASS ${test.name}`);
  }

  console.log(`Completed ${tests.length} container tests.`);
}

void main().catch((error: unknown) => {
  console.error("Container tests failed.", error);
  process.exit(1);
});
