const assert = require('assert');
const Backoff = require('../lib/Backoff');

describe('Backoff', () => {
    
    it('should create backoff with default steps', () => {
        const backoff = new Backoff();
        assert.strictEqual(backoff.current_step, 0);
        assert.strictEqual(backoff.current_delay_ms, 1000); // 1 second in ms
    });

    it('should create backoff with custom steps', () => {
        const backoff = new Backoff([1, 2, 4, 8, 16, 32, 60]);
        assert.strictEqual(backoff.current_step, 0);
        assert.strictEqual(backoff.current_delay_ms, 1000); // 1 second in ms
        assert.strictEqual(backoff.max_delay_ms, 60000); // 60 seconds in ms
    });

    it('should throw error for invalid steps', () => {
        assert.throws(() => new Backoff([]), /steps must be a non-empty array/);
        assert.throws(() => new Backoff('not an array'), /steps must be a non-empty array/);
        assert.throws(() => new Backoff([1, -1, 3]), /all steps must be non-negative numbers/);
        assert.throws(() => new Backoff([1, 'invalid', 3]), /all steps must be non-negative numbers/);
    });

    it('should advance through steps correctly', async () => {
        const backoff = new Backoff([0, 0.001, 0.002]); // Very small delays for testing
        
        assert.strictEqual(backoff.current_step, 0);
        assert.strictEqual(backoff.current_delay_ms, 0);
        
        await backoff.interval();
        assert.strictEqual(backoff.current_step, 1);
        assert.strictEqual(backoff.current_delay_ms, 1);
        
        await backoff.interval();
        assert.strictEqual(backoff.current_step, 2);
        assert.strictEqual(backoff.current_delay_ms, 2);
        
        // Should stay at last step
        await backoff.interval();
        assert.strictEqual(backoff.current_step, 2);
        assert.strictEqual(backoff.current_delay_ms, 2);
    });

    it('should reset correctly', async () => {
        const backoff = new Backoff([0, 0.001, 0.002]);
        
        await backoff.interval(); // Step 1
        await backoff.interval(); // Step 2
        assert.strictEqual(backoff.current_step, 2);
        
        backoff.reset();
        assert.strictEqual(backoff.current_step, 0);
        assert.strictEqual(backoff.current_delay_ms, 0);
    });

    it('should wait for correct duration', async () => {
        const backoff = new Backoff([0.001]); // 1ms delay
        const start = Date.now();
        
        await backoff.interval();
        
        const elapsed = Date.now() - start;
        assert(elapsed >= 1, `Expected elapsed time >= 1ms, got ${elapsed}ms`);
        assert(elapsed < 10, `Expected elapsed time < 10ms, got ${elapsed}ms`);
    });
});
