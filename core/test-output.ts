import { ITest, ITestFixture } from "./_interfaces";
import { MatchError } from "./_errors";
import { TestCaseResult, TestOutcome } from "./_results";

export class TestOutput {

    private _outStream: NodeJS.WritableStream;
    private _messages = [];
    private _currIndex = 0;

    constructor (outStream: NodeJS.WritableStream) {
        this._outStream = outStream;
    }

    public end() {
      this._outStream.end();
   }

    private _writeOut(message: string): void {
      this._messages.push();
        this._outStream._read = () => {
           if (this._currIndex === this._messages.length) {
             this._outStream.push(null);
          }
          else {
             this._outStream.push(this._messages[this._currIndex ++])
          }
         }
    }

    public emitVersion(): void {
        this._writeOut("TAP version 13\n");
    }

    public emitPlan(testCount: number): void {
        this._writeOut(`1..${testCount}\n`);
    }

    public emitFixture(fixture: ITestFixture): void {
        this._writeOut(`# FIXTURE ${fixture.description}\n`);
    }

    public emitResult(testId: number, result: TestCaseResult): void {
        let outcome = result.outcome;
        let test = result.test;
        let testCaseArguments = result.arguments;

        if (outcome === TestOutcome.Pass) {
            this._emitPass(testId, test, testCaseArguments);
        } else if (outcome === TestOutcome.Fail || outcome === TestOutcome.Error) {
            let error = result.error;

            this._emitFail(testId, test, testCaseArguments, error);
        } else if (outcome === TestOutcome.Skip) {
            this._emitSkip(testId, test, testCaseArguments);
        } else {
            throw new TypeError(`Invalid test outcome: ${outcome}`);
        }
    }

    private _emitPass(testId: number, test: ITest, testCaseArguments: Array<any>): void {
        let description = this._getTestDescription(test, testCaseArguments);

        this._writeOut(`ok ${testId} ${description}\n`);
    }

    private _emitSkip(testId: number, test: ITest, testCaseArguments: Array<any>): void {
        let description = this._getTestDescription(test, testCaseArguments);

        // we only want to use the reason if it's not undefined
        let reasonString = "";

        if (test.ignoreReason !== undefined) {
            reasonString = ` ${test.ignoreReason}`;
        }

        this._writeOut(`ok ${testId} ${description} # skip${reasonString}\n`);
    }

    private _emitFail(testId: number, test: ITest, testCaseArguments: Array<any>, error: Error): void {
        let description = this._getTestDescription(test, testCaseArguments);

        this._writeOut(`not ok ${testId} ${description}\n`);

        if (error instanceof MatchError) {
            let yaml = this._getErrorYaml(error);

            this._writeOut(yaml);
        } else {
            this._writeOut(`# ERROR: ${error.message}\n`);
        }

    }

    private _getTestDescription(test: ITest, testCaseArguments: Array<any>): string {
        let testDescription = test.description;

        if (testCaseArguments !== undefined && testCaseArguments.length > 0) {
            testDescription += ` [ ${testCaseArguments.map(argument => this._getArgumentDescription(argument)).join(", ")} ]`;
        }

        return testDescription;
    }

    private _getArgumentDescription(argument: any): string {

      const jsonArgument = JSON.stringify(argument);

      // if the argument can be expresed as JSON return that
      if (jsonArgument) {
         return JSON.stringify(argument);
      }
      // otherwise if it's a function return it's name
      else if (argument && argument.name) {
         return argument.name;
      }
      else if (argument instanceof Function) {
         return "anonymous function";
      }

      // otherwise must be undefined
      return "undefined";
    }

    private _getErrorYaml(error: MatchError): string {
        return " ---\n" +
                "   message: \"" + error.message.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"\n" +
                "   severity: fail\n" +
                "   data:\n" +
                "     got: " + JSON.stringify(error.actualValue) + "\n" +
                "     expect: " + JSON.stringify(error.expectedValue) + "\n ...\n";
    }

}
