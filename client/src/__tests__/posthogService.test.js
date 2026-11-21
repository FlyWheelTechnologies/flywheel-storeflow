import { describe, it, expect } from 'vitest';
import { dropMaskedScriptErrors } from '../services/posthogService';

const exceptionEvent = (exceptionList) => ({
  event: '$exception',
  properties: { $exception_list: exceptionList }
});

describe('dropMaskedScriptErrors', () => {
  it('should drop a cross-origin "Script error." without a stack', () => {
    const event = exceptionEvent([
      { type: 'Error', value: 'Script error.', mechanism: { handled: false, synthetic: true } }
    ]);
    expect(dropMaskedScriptErrors(event)).toBeNull();
  });

  it('should keep a "Script error." that has stack frames', () => {
    const event = exceptionEvent([
      { type: 'Error', value: 'Script error.', stacktrace: { frames: [{ filename: 'app.js' }] } }
    ]);
    expect(dropMaskedScriptErrors(event)).toBe(event);
  });

  it('should keep other exceptions', () => {
    const event = exceptionEvent([{ type: 'TypeError', value: 'x is undefined' }]);
    expect(dropMaskedScriptErrors(event)).toBe(event);
  });

  it('should keep non-exception events', () => {
    const event = { event: '$pageview', properties: {} };
    expect(dropMaskedScriptErrors(event)).toBe(event);
  });
});
