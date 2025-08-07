const assert = require('assert');
const Notion = require('../lib/Notion');

describe('Notion', function () {

    let notion;

    it('should create a notion with name and default value', function () {
        notion = new Notion('test_notion', 'default_value');
        assert.strictEqual(notion.name, 'test_notion');
        assert.strictEqual(notion.value, 'default_value');
        assert.strictEqual(notion.timestamp, undefined);
    });

    it('should set value and timestamp using set_value', function () {
        notion = new Notion('test_notion', 'default_value');
        const testDate = new Date('2023-01-01T12:00:00Z');
        notion.set_value('test_value', testDate);
        assert.strictEqual(notion.value, 'test_value');
        assert.strictEqual(notion.timestamp, testDate);
    });

    it('should emit changed event when value changes', function (done) {
        notion = new Notion('test_notion', 'default_value');
        notion.on('changed', function (event) {
            assert.strictEqual(event.property, 'test_notion');
            assert.strictEqual(event.old_value, undefined);
            assert.strictEqual(event.new_value, 'new_value');
            done();
        });
        notion.value = 'new_value';
    });

    it('should not emit event when value and timestamp are unchanged', function () {
        notion = new Notion('test_notion', 'default_value');
        const testDate = new Date();
        notion.set_value('test_value', testDate);
        
        let eventEmitted = false;
        notion.on('changed', function () {
            eventEmitted = true;
        });
        
        notion.set_value('test_value', testDate);
        assert.strictEqual(eventEmitted, false);
    });

    it('should use setter mapping when setting with object', function () {
        const mappedNotion = new Notion('mapped', 'default', { value: 'data', timestamp: 'ts' });
        const testDate = new Date();
        const inputObject = {
            data: 'mapped_value',
            ts: testDate
        };
        
        mappedNotion.set_value(inputObject);
        assert.strictEqual(mappedNotion.value, 'mapped_value');
        assert.strictEqual(mappedNotion.timestamp, testDate);
    });

    it('should convert to object with all properties', function () {
        notion = new Notion('test_notion', 'default_value');
        const testDate = new Date();
        notion.set_value('test_value', testDate);
        
        const obj = notion.toObject();
        assert.strictEqual(obj.name, 'test_notion');
        assert.strictEqual(obj.value, 'test_value');
        assert.strictEqual(obj.timestamp, testDate);
    });

    it('should create notion from object using fromObject', function () {
        const testDate = new Date();
        const obj = {
            name: 'restored_notion',
            value: 'restored_value',
            timestamp: testDate
        };
        
        const restoredNotion = Notion.fromObject(obj);
        assert.strictEqual(restoredNotion.name, 'restored_notion');
        assert.strictEqual(restoredNotion.value, 'restored_value');
        assert.strictEqual(restoredNotion.timestamp, testDate);
    });

    it('should throw error for invalid setter mapping', function () {
        assert.throws(() => {
            new Notion('test', 'default', { timestamp: 'ts' });
        }, /setter_mapping must have a "value" key of type string/);
    });

    it('should throw error for invalid timestamp', function () {
        notion = new Notion('test_notion', 'default_value');
        assert.throws(() => {
            notion.set_value('test', 'invalid-date');
        }, /Invalid timestamp string/);
    });

    it('should handle falsy values correctly', function () {
        notion = new Notion('falsy_test', 'default');
        
        notion.value = 0;
        assert.strictEqual(notion.value, 0);
        
        notion.value = false;
        assert.strictEqual(notion.value, false);
        
        // null and undefined cause the getter to return the default value
        notion.value = null;
        assert.strictEqual(notion.value, 'default');
    });
});
