/**
 * Handles exponential backoff for retry logic
 * 
 * @class Backoff
 */
class Backoff {
    
    #steps;
    #currentStep = 0;
    #maxDelay;

    /**
     * Creates an instance of Backoff.
     * @param {number[]} steps - Array of backoff intervals in seconds
     */
    constructor(steps = [1, 2, 4, 8, 16, 32, 60]) {
        if (!Array.isArray(steps) || steps.length === 0) {
            throw new TypeError('steps must be a non-empty array');
        }
        
        this.#steps = steps.map(step => {
            if (typeof step !== 'number' || step < 0) {
                throw new TypeError('all steps must be non-negative numbers');
            }
            return step * 1000; // Convert seconds to milliseconds
        });
        
        this.#maxDelay = Math.max(...this.#steps);
        this.#currentStep = 0;
    }

    /**
     * Wait for the current backoff interval and advance to the next step
     * @returns {Promise<void>}
     */
    async interval() {
        const delayMs = this.#steps[this.#currentStep];
        
        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        // Advance to next step, but don't exceed the array length
        if (this.#currentStep < this.#steps.length - 1) {
            this.#currentStep++;
        }
    }    /**
     * Reset the backoff to the first step
     */
    reset() {
        this.#currentStep = 0;
    }

    /**
     * Get the current backoff delay in milliseconds
     * @returns {number} Current delay in milliseconds
     */
    get current_delay_ms() {
        return this.#steps[this.#currentStep];
    }

    /**
     * Get the current step number (0-based)
     * @returns {number} Current step number
     */
    get current_step() {
        return this.#currentStep;
    }

    /**
     * Get the maximum delay in milliseconds
     * @returns {number} Maximum delay in milliseconds
     */
    get max_delay_ms() {
        return this.#maxDelay;
    }
}

module.exports = Backoff;
