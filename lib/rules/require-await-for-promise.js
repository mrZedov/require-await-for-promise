import { ESLintUtils } from '@typescript-eslint/utils';

const PROMISE_AGGREGATORS = [
  'all',
  'race',
  'allSettled',
  'any',
  'resolve',
  'reject',
];

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Requires await or then/catch/finally when calling functions that return a Promise',
      recommended: false,
    },
    messages: {
      missingAwait:
        'A call to a function returning a Promise must use await or then/catch/finally',
    },
    schema: [],
  },

  create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    const typeChecker = parserServices.program.getTypeChecker();

    function isPromiseAggregatorArgument(node) {
      let current = node;

      while (current.parent) {
        const parent = current.parent;

        if (
          parent.type === 'ArrayExpression' &&
          parent.parent?.type === 'CallExpression'
        ) {
          const callExpr = parent.parent;
          if (
            callExpr.callee.type === 'MemberExpression' &&
            callExpr.callee.object.type === 'Identifier' &&
            callExpr.callee.object.name === 'Promise' &&
            callExpr.callee.property.type === 'Identifier' &&
            PROMISE_AGGREGATORS.includes(callExpr.callee.property.name)
          ) {
            return true;
          }
        }

        if (parent.type === 'CallExpression') {
          const callExpr = parent;
          if (
            callExpr.callee.type === 'MemberExpression' &&
            callExpr.callee.object.type === 'Identifier' &&
            callExpr.callee.object.name === 'Promise' &&
            callExpr.callee.property.type === 'Identifier' &&
            PROMISE_AGGREGATORS.includes(callExpr.callee.property.name)
          ) {
            return true;
          }
        }

        if (
          parent.type === 'ArrowFunctionExpression' ||
          parent.type === 'FunctionExpression'
        ) {
          current = parent;
          continue;
        }

        if (
          parent.type === 'CallExpression' &&
          parent.callee?.type === 'MemberExpression'
        ) {
          // do nothing
        }

        current = parent;
      }

      return false;
    }

    function isHandledPromiseChain(node) {
      let current = node.parent;
      let steps = 0;
      const MAX_STEPS = 30;

      while (current && steps < MAX_STEPS) {
        steps++;

        if (current.type === 'AwaitExpression') return true;

        if (
          current.type === 'MemberExpression' &&
          current.property &&
          ['then', 'catch', 'finally'].includes(current.property.name)
        ) {
          return true;
        }

        if (
          current.type === 'CallExpression' &&
          current.callee &&
          current.callee.type === 'MemberExpression'
        ) {
          current = current.callee;
          continue;
        }

        if (current.type === 'MemberExpression' && current.object) {
          current = current.object;
          continue;
        }

        if (current.type === 'ExpressionStatement') break;

        current = current.parent;
      }

      return false;
    }

    function checkLogicalReturnPromise(node, parserServices, typeChecker) {
      if (
        node.type === 'LogicalExpression' &&
        (node.operator === '||' || node.operator === '&&') &&
        node.parent &&
        node.parent.type === 'ReturnStatement'
      ) {
        const left = node.left;
        const right = node.right;

        function isUnawaitedPromiseCall(expr) {
          if (expr.type !== 'CallExpression') return false;

          if (expr.parent && expr.parent.type === 'AwaitExpression')
            return false;

          const tsNode = parserServices.esTreeNodeToTSNodeMap.get(expr);
          if (!tsNode) return false;
          const signature = typeChecker.getResolvedSignature(tsNode);
          if (!signature) return false;
          const returnType = typeChecker.getReturnTypeOfSignature(signature);
          const returnTypeString = typeChecker.typeToString(returnType);
          return returnTypeString.startsWith('Promise<');
        }

        if (isUnawaitedPromiseCall(left) || isUnawaitedPromiseCall(right)) {
          // If at least one side is an async method call without await
          // can be improved to allow the right-most in return without await
          return true;
        }
      }
      return false;
    }

    function findUnawaitedPromiseCallsInLogical(
      node,
      parserServices,
      typeChecker
    ) {
      let found = false;
      function check(expr) {
        if (expr.type === 'CallExpression') {
          if (!expr.parent || expr.parent.type !== 'AwaitExpression') {
            const tsNode = parserServices.esTreeNodeToTSNodeMap.get(expr);
            if (tsNode) {
              const signature = typeChecker.getResolvedSignature(tsNode);
              if (signature) {
                const returnType =
                  typeChecker.getReturnTypeOfSignature(signature);
                const returnTypeString = typeChecker.typeToString(returnType);
                if (returnTypeString.startsWith('Promise')) {
                  found = true;
                }
              }
            }
          }
        } else if (expr.type === 'LogicalExpression') {
          check(expr.left);
          check(expr.right);
        }
      }
      check(node);
      return found;
    }

    return {
      CallExpression(node) {
        if (node.callee.type === 'Identifier') {
          const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
          if (!tsNode) return;

          const signature = typeChecker.getResolvedSignature(tsNode);
          if (!signature) return;

          const returnType = typeChecker.getReturnTypeOfSignature(signature);
          const returnTypeString = typeChecker.typeToString(returnType);

          const isPromise = returnTypeString.startsWith('Promise<');
          if (!isPromise) return;

          const parent = node.parent;

          if (parent.type === 'ReturnStatement') return;

          const check1 = isHandledPromiseChain(node);
          const check2 = isPromiseAggregatorArgument(node);
          if (check1 || check2) {
            return;
          }

          context.report({
            node,
            messageId: 'missingAwait',
          });
        } else {
          if (
            checkLogicalReturnPromise(node.parent, parserServices, typeChecker)
          ) {
            context.report({
              node,
              messageId: 'missingAwait',
            });
            return;
          }
          return;
        }
      },

      LogicalExpression(node) {
        if (
          node.parent &&
          node.parent.type === 'ReturnStatement' &&
          findUnawaitedPromiseCallsInLogical(node, parserServices, typeChecker)
        ) {
          context.report({
            node,
            messageId: 'missingAwait',
          });
        }
      },
    };
  },
};

// These are test cases

// import { Logger } from '@nethunt/module-nodejs';
// import * as AutomationInstances from './data/automationInstances.js';

// const log = Logger('testRule');

// async function delayedStringAsync(message?: string): Promise<string> {
//   return new Promise((resolve) => {
//     setTimeout(() => {
//       resolve(message || 'Hello, world!');
//     }, 2000);
//   });
// }

// async function testRule(): Promise<string> {
//   const res1 = await delayedStringAsync();

//   await delayedStringAsync();
//   delayedStringAsync().then(() => { });
//   delayedStringAsync().catch(() => { });
//   Promise.all([delayedStringAsync()]);
//   Promise.resolve(delayedStringAsync());

//   const arr = [1, 2];
//   const res2 = await Promise.all(arr.map(() => delayedStringAsync()));
//   log.info(res1, res2);

//   return delayedStringAsync();
// }

// async function testRule2(): Promise<string> {
//   return delayedStringAsync(); // OK. await is redundant here
// }

// async function testRule3(): Promise<string> {
//   return delayedStringAsync();
// }

// async function testRule4(): Promise<string> {
//   const v = delayedStringAsync(); // OK. Promise<string> is not awaited
//   return delayedStringAsync(await v);
// }

// async function testRule5(): Promise<string> {  // error: Promise<string> is not awaited
//   return delayedStringAsync()
//     || delayedStringAsync()
//     || delayedStringAsync();
// }

// async function acquireNextAutomationInstance1() { // error: Promise<string> is not awaited
//   return AutomationInstances.acquireNextTriggeringAutomationInstance()
//     || AutomationInstances.acquireNextExecutingAutomationInstance();
// }

// async function acquireNextAutomationInstance2() { // error: Promise<string> is not awaited
//   return AutomationInstances.acquireNextTriggeringAutomationInstance()
//     || AutomationInstances.acquireNextExecutingAutomationInstance()
//     || undefined;
// }

// async function testRule6(): Promise<string> { // error: Promise<string> is not awaited
//   return await delayedStringAsync()
//     || delayedStringAsync();
// }

// async function testRule7(): Promise<string> {
//   return await delayedStringAsync() // Ok. await is used
//     || await delayedStringAsync();
// }

// async function testRule8(): Promise<string> {
//   return await delayedStringAsync() || await delayedStringAsync() || 'default value';
// }

// testRule()
//   .then(() => { })
//   .catch(() => { });

// await testRule2();
// await testRule3();
// await testRule4();
// await testRule5();
// await testRule6();
// await testRule7();
// await testRule8();
// await acquireNextAutomationInstance1();
// await acquireNextAutomationInstance2();
