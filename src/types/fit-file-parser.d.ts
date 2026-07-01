declare module 'fit-file-parser' {
  interface FitParserOptions {
    force?: boolean
    speedUnit?: string
    lengthUnit?: string
    temperatureUnit?: string
    elapsedRecordField?: boolean
    mode?: string
  }
  class FitParser {
    constructor(options?: FitParserOptions)
    parse(content: ArrayBuffer | Buffer, callback: (error: Error | null, data: unknown) => void): void
  }
  export default FitParser
}
