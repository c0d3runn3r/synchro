const SynchroItem = require('../lib/SynchroItem');

class Dog extends SynchroItem {
    constructor(id) {
        super(id);
        this.observed_properties = ['name', 'age', 'barking'];
        
        // Auto-generate name if not provided
        if (!this._name) {
            this._name = this._random_name();
        }
        
        // Auto-generate age if not provided  
        if (!this._age) {
            this._age = this._random_age();
        }
        
        // Initialize barking to false if not provided
        if (this._barking === undefined) {
            this._barking = false;
        }
        
        this.dirty();
    }

    set name(value) {
        this._name = value;
        this.dirty();
    }
    
    get name() {
        return this._name;
    }

    set age(value) {
        this._age = value;
        this.dirty();
    }
    
    get age() {
        return this._age;
    }

    set barking(value) {
        this._barking = value;
        this.dirty();
    }
    
    get barking() {
        return this._barking;
    }

    /**
     * Generate a random dog name with emoticons
     * @private
     * @returns {string} A random dog name with two random dog-relevant emoticons
     */
    _random_name() {
        const names = [
            'Buddy', 'Max', 'Charlie', 'Bella', 'Lucy', 'Cooper', 'Bailey', 'Daisy',
            'Sadie', 'Lola', 'Tucker', 'Molly', 'Jack', 'Sophie', 'Bear', 'Maggie',
            'Duke', 'Roxy', 'Rocky', 'Luna', 'Toby', 'Coco', 'Riley', 'Zeus',
            'Ruby', 'Oliver', 'Milo', 'Penny', 'Leo', 'Rosie'
        ];
        
        const dog_emoticons = [
            '🐕', '🐶', '🦴', '🎾', '🏃', '❤️', '🌟', '⭐', '🎈', '🎁',
            '🌈', '☀️', '🌺', '🌸', '🍖', '🥎', '🎯', '🏆', '👑', '💎',
            '🔥', '⚡', '🎊', '🎉', '🎭', '🎪', '🚀', '🌙', '✨', '💫'
        ];
        
        const base_name = names[Math.floor(Math.random() * names.length)];
        
        // Select two random emoticons
        const first_emoticon = dog_emoticons[Math.floor(Math.random() * dog_emoticons.length)];
        let second_emoticon = dog_emoticons[Math.floor(Math.random() * dog_emoticons.length)];
        
        // Ensure we don't get the same emoticon twice
        while (second_emoticon === first_emoticon) {
            second_emoticon = dog_emoticons[Math.floor(Math.random() * dog_emoticons.length)];
        }
        
        return `${base_name} ${first_emoticon}${second_emoticon}`;
    }

    /**
     * Generate a random dog age between 1 and 15 years
     * @private
     * @returns {number} A random age in years
     */
    _random_age() {
        return Math.floor(Math.random() * 15) + 1;
    }

    /**
     * String representation of the dog
     * @returns {string} A formatted string showing the dog's name, age, and barking status
     */
    toString() {
        // Ensure the string is properly encoded
        return `Dog { name = ${String(this.name)}, age = ${String(this.age)}, ${this.barking?'BARKING':''} }`;
    }
}

module.exports = Dog;
