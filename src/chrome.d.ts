declare namespace chrome {
    export namespace scripting {
      export function executeScript(details: {
        target: { tabId: number };
        func: () => any;
      }): Promise<{ result: any }[]>;
    }
  }