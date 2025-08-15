/**
 * Utility class to convert ANSI color codes (from yaclc/yalls) to blessed color tags
 */
class ColorConverter {
    constructor() {
        // Map ANSI color codes to blessed color names
        this.ansi_to_blessed_colors = {
            '\x1b[30m': 'black',     // black text
            '\x1b[31m': 'red',       // red text  
            '\x1b[32m': 'green',     // green text
            '\x1b[33m': 'yellow',    // yellow text
            '\x1b[34m': 'blue',      // blue text
            '\x1b[35m': 'magenta',   // magenta text
            '\x1b[36m': 'cyan',      // cyan text
            '\x1b[37m': 'white',     // white text
            '\x1b[1m': 'bold',       // bold font
            '\x1b[2m': 'dim',        // faint/dim font
            '\x1b[4m': 'underline',  // underlined font
            '\x1b[5m': 'blink',      // blinking font
            '\x1b[0m': 'reset'       // reset all formatting
        };

        // Regex to match ANSI escape sequences
        this.ansi_regex = /\x1b\[[0-9;]*m/g;
        this.rgb_regex = /\x1b\[38;2;(\d+);(\d+);(\d+)m/g; // RGB foreground colors
        this.bg_rgb_regex = /\x1b\[48;2;(\d+);(\d+);(\d+)m/g; // RGB background colors
    }

    /**
     * Convert ANSI colored text to blessed format
     * 
     * @param {string} ansi_text - Text with ANSI color codes
     * @returns {string} Text with blessed color tags
     */
    convert_to_blessed_format(ansi_text) {
        let result = ansi_text;
        let color_stack = [];

        // Handle RGB colors first (more specific)
        result = result.replace(this.rgb_regex, (match, r, g, b) => {
            const color = this.rgb_to_hex(r, g, b);
            color_stack.push(color);
            return `{${color}-fg}`;
        });

        result = result.replace(this.bg_rgb_regex, (match, r, g, b) => {
            const color = this.rgb_to_hex(r, g, b);
            return `{${color}-bg}`;
        });

        // Handle standard ANSI color codes
        result = result.replace(this.ansi_regex, (match) => {
            const blessed_color = this.ansi_to_blessed_colors[match];
            
            if (blessed_color) {
                if (blessed_color === 'reset') {
                    // Close all open color tags
                    const close_tags = color_stack.map(() => '{/}').join('');
                    color_stack = [];
                    return close_tags;
                } else if (blessed_color === 'bold') {
                    return '{bold}';
                } else if (blessed_color === 'dim') {
                    return '{dim}';
                } else if (blessed_color === 'underline') {
                    return '{underline}';
                } else if (blessed_color === 'blink') {
                    return '{blink}';
                } else {
                    // Regular color
                    color_stack.push(blessed_color);
                    return `{${blessed_color}-fg}`;
                }
            }
            
            return match; // Keep unknown codes as-is
        });

        // Ensure all tags are closed at the end
        if (color_stack.length > 0) {
            result += color_stack.map(() => '{/}').join('');
        }

        return result;
    }

    /**
     * Strip all ANSI color codes from text
     * 
     * @param {string} ansi_text - Text with ANSI color codes
     * @returns {string} Plain text without color codes
     */
    strip_ansi_codes(ansi_text) {
        return ansi_text
            .replace(this.rgb_regex, '')
            .replace(this.bg_rgb_regex, '')
            .replace(this.ansi_regex, '');
    }

    /**
     * Convert RGB values to hex color
     * 
     * @param {string|number} r - Red component (0-255)
     * @param {string|number} g - Green component (0-255) 
     * @param {string|number} b - Blue component (0-255)
     * @returns {string} Hex color code (e.g., "#ff0000")
     */
    rgb_to_hex(r, g, b) {
        const to_hex = (n) => {
            const hex = parseInt(n).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${to_hex(r)}${to_hex(g)}${to_hex(b)}`;
    }

    /**
     * Test the converter with sample text
     * 
     * @returns {string} Test output showing conversion
     */
    test() {
        const test_text = '\x1b[31m\x1b[1mERROR\x1b[0m | \x1b[35mINFO\x1b[0m | \x1b[33mWARN\x1b[0m';
        const converted = this.convert_to_blessed_format(test_text);
        const stripped = this.strip_ansi_codes(test_text);
        
        return {
            original: test_text,
            converted: converted,
            stripped: stripped
        };
    }
}

module.exports = ColorConverter;
