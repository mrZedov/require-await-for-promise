# eslint-plugin-require-await-for-promise

ESLint rule that enforces using `await` or `.then/.catch/.finally()` when calling functions that return a `Promise`.

## ✨ Features

- Prevents unhandled `Promise` calls that could lead to missed errors or unpredictable behavior.
- Recognizes calls inside `Promise.all`, `Promise.race`, `Promise.any`, and other aggregators.
- Checks logical expressions that return `Promise` values (e.g., `return asyncCall1() || asyncCall2()`).
- Built using `@typescript-eslint/utils` and the TypeScript `TypeChecker` to accurately determine return types.

## 📦 Installation

```bash
npm install --save-dev eslint-plugin-require-await-for-promise
```

## 🔧 Configuration

Add the plugin and rule to your ESLint configuration:

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "plugins": ["require-await-for-promise"],
  "rules": {
    "require-await-for-promise/require-await-for-promise": "error"
  }
}
```

> ⚠️ Make sure to specify `parserOptions.project`, as the rule relies on the TypeScript type checker.

---

## ✅ Valid Examples

```ts
// ✅ Uses await
await delayedStringAsync();

// ✅ Uses .then()
delayedStringAsync().then(() => {});

// ✅ Returning a Promise is allowed
return delayedStringAsync();

// ✅ Called inside Promise.all
await Promise.all([delayedStringAsync()]);

// ✅ Logical expression with properly handled Promises
return await delayedStringAsync() || await delayedStringAsync();
```

---

## ❌ Invalid Examples

```ts
// ❌ Call without await or any handling
delayedStringAsync();

// ❌ Logical expression without await
return delayedStringAsync() || delayedStringAsync();

// ❌ Only one Promise wrapped in await
return await delayedStringAsync() || delayedStringAsync();

// ❌ Returning unhandled Promises in a logical expression
return Instances.acquireNextFirstInstance()
  || Instances.acquireNextSecondInstance();
```

---

## 🧠 How the Rule Works

- 🔍 Checks whether a function call returns a `Promise<...>` using the TypeScript API.
- ⛔ Reports the call if it:
  - is not wrapped with `await`,
  - does not use `.then/.catch/.finally`,
  - is not part of `Promise.all`, `race`, `any`, `allSettled`, `resolve`, or `reject`.
- ✅ Allows `return PromiseFn()` if it's the final statement in an `async` function.

---

## 🧪 Example Test Function

```ts
async function testRule(): Promise<string> {
  delayedStringAsync(); // ❌ error
  await delayedStringAsync(); // ✅ OK
  delayedStringAsync().then(() => {}); // ✅ OK
  return delayedStringAsync(); // ✅ OK
  return delayedStringAsync() || delayedStringAsync(); // ❌ error
}
```

---

## 📝 License

MIT

---

## 👤 Author

[github.com/mrZedov](https://github.com/mrZedov)
