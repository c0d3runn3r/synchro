## Classes

<dl>
<dt><a href="#Notion">Notion</a></dt>
<dd><p>Represents a Notion, which is a key-value pair with a timestamp.</p>
</dd>
<dt><a href="#SynchroItem">SynchroItem</a></dt>
<dd><p>SynchroItem is a base class for items that can be synchronized.</p>
</dd>
<dt><a href="#SynchroSet">SynchroSet</a></dt>
<dd></dd>
</dl>

<a name="Notion"></a>

## Notion
Represents a Notion, which is a key-value pair with a timestamp.

**Kind**: global class  
**Emits**: [<code>changed</code>](#Notion+event_changed)  

* [Notion](#Notion)
    * [new Notion(name, default_value, [setter_mapping])](#new_Notion_new)
    * _instance_
        * [.name](#Notion+name) ⇒ <code>string</code>
        * [.value](#Notion+value) ⇒ <code>\*</code>
        * [.timestamp](#Notion+timestamp) ⇒ <code>Date</code>
        * [.value](#Notion+value)
        * [.set_value(value, timestamp)](#Notion+set_value)
        * ["changed"](#Notion+event_changed)
    * _static_
        * [.fromObject(obj)](#Notion.fromObject) ⇒ [<code>Notion</code>](#Notion)

<a name="new_Notion_new"></a>

### new Notion(name, default_value, [setter_mapping])
Creates a new Notion instance.

**Throws**:

- <code>Error</code> If setter_mapping is provided but not an object or is missing the required keys.


| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | The name of the notion. |
| default_value | <code>\*</code> | The default value of the notion. |
| [setter_mapping] | <code>object</code> | Optional mapping for setter. Will cause .set_value() to set value and timestamp using specific keys instead of the raw values passed to it. |
| [setter_mapping.value] | <code>string</code> | The key to use to find the value when set with an object. |
| [setter_mapping.timestamp] | <code>string</code> | The key to use to find the timestamp when set with an object. |

<a name="Notion+name"></a>

### notion.name ⇒ <code>string</code>
Returns the name of the notion.

**Kind**: instance property of [<code>Notion</code>](#Notion)  
**Returns**: <code>string</code> - The name of the notion.  
<a name="Notion+value"></a>

### notion.value ⇒ <code>\*</code>
Returns the value of the notion.
If the value is not set, it returns the default value.

**Kind**: instance property of [<code>Notion</code>](#Notion)  
**Returns**: <code>\*</code> - The value of the notion or the default value if not set.  
<a name="Notion+timestamp"></a>

### notion.timestamp ⇒ <code>Date</code>
Returns the timestamp of the last update.

**Kind**: instance property of [<code>Notion</code>](#Notion)  
**Returns**: <code>Date</code> - The timestamp of the last update, or undefined if not set.  
<a name="Notion+value"></a>

### notion.value
Convenience setter for set_value()

**Kind**: instance property of [<code>Notion</code>](#Notion)  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | The value to set for the notion. |

<a name="Notion+set_value"></a>

### notion.set\_value(value, timestamp)
Sets the value and timestamp of the notion.

If setter_mapping was set in the constructor, and if we pass an object with matching keys,
we will use those values instead of the raw `value` and `timestamp` parameters.

**Kind**: instance method of [<code>Notion</code>](#Notion)  
**Throws**:

- <code>Error</code> If timestamp is neither a valid Date object nor a valid date string


| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> |  |
| timestamp | <code>Date</code> \| <code>string</code> | A Date object or a string that can be parsed by the Date constructor |

<a name="Notion+event_changed"></a>

### "changed"
Emitted when the value changes.

**Kind**: event emitted by [<code>Notion</code>](#Notion)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| property | <code>string</code> | The name of the changed property. |
| old_value | <code>\*</code> | The previous value of the property. |
| new_value | <code>\*</code> | The new value of the property. |

<a name="Notion.fromObject"></a>

### Notion.fromObject(obj) ⇒ [<code>Notion</code>](#Notion)
Creates a Notion instance from an object.

**Kind**: static method of [<code>Notion</code>](#Notion)  
**Returns**: [<code>Notion</code>](#Notion) - A new Notion instance.  
**Throws**:

- <code>TypeError</code> If the object is not valid or missing required properties.


| Param | Type | Description |
| --- | --- | --- |
| obj | <code>object</code> | The object to create the Notion from. |

<a name="SynchroItem"></a>

## SynchroItem
SynchroItem is a base class for items that can be synchronized.

**Kind**: global class  

* [SynchroItem](#SynchroItem)
    * *[.id](#SynchroItem+id) ⇒ <code>string</code>*
    * [.observed_properties](#SynchroItem+observed_properties)
    * [.observed_properties](#SynchroItem+observed_properties) ⇒ <code>Array.&lt;string&gt;</code>
    * [.set(name, value, [timestamp])](#SynchroItem+set)
    * [.unset(name)](#SynchroItem+unset)
    * [.notion(name)](#SynchroItem+notion) ⇒ [<code>Notion</code>](#Notion)
    * [.get(name)](#SynchroItem+get) ⇒ <code>\*</code>
    * [.dirty()](#SynchroItem+dirty)
    * ["changed"](#SynchroItem+event_changed)

<a name="SynchroItem+id"></a>

### *synchroItem.id ⇒ <code>string</code>*
Get our ID

**Kind**: instance abstract property of [<code>SynchroItem</code>](#SynchroItem)  
**Returns**: <code>string</code> - the ID of this item  
<a name="SynchroItem+observed_properties"></a>

### synchroItem.observed\_properties
Sets the properties to observe.

**Kind**: instance property of [<code>SynchroItem</code>](#SynchroItem)  
**Throws**:

- <code>TypeError</code> If the input is not an array.


| Param | Type | Description |
| --- | --- | --- |
| properties | <code>Array.&lt;string&gt;</code> | An array of property names to observe. |

<a name="SynchroItem+observed_properties"></a>

### synchroItem.observed\_properties ⇒ <code>Array.&lt;string&gt;</code>
Gets the names of the observed properties.

**Kind**: instance property of [<code>SynchroItem</code>](#SynchroItem)  
**Returns**: <code>Array.&lt;string&gt;</code> - An array of observed property names.  
<a name="SynchroItem+set"></a>

### synchroItem.set(name, value, [timestamp])
Sets a notion value, adding it if it doesn't exist.

This is an alternative to subclassing the SynchroItem and using properties.

**Kind**: instance method of [<code>SynchroItem</code>](#SynchroItem)  
**Emits**: <code>SynchroItem#changed (actually Notion#event:changed)</code>  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | the name of the notion |
| value | <code>\*</code> | the value of the notion |
| [timestamp] | <code>Date</code> \| <code>string</code> | the timestamp of the notion |

<a name="SynchroItem+unset"></a>

### synchroItem.unset(name)
Remove a notion by name

**Kind**: instance method of [<code>SynchroItem</code>](#SynchroItem)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | the name of the notion |

<a name="SynchroItem+notion"></a>

### synchroItem.notion(name) ⇒ [<code>Notion</code>](#Notion)
Get a notion by name

**Kind**: instance method of [<code>SynchroItem</code>](#SynchroItem)  
**Returns**: [<code>Notion</code>](#Notion) - the notion object  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | the name of the notion |

<a name="SynchroItem+get"></a>

### synchroItem.get(name) ⇒ <code>\*</code>
Get a notion value by name

**Kind**: instance method of [<code>SynchroItem</code>](#SynchroItem)  
**Returns**: <code>\*</code> - the value of the notion  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | the name of the notion |

<a name="SynchroItem+dirty"></a>

### synchroItem.dirty()
Something has changed that may result in a change to a watched property.

This function should be called whenever a property that is being observed may have changed.
It will check all observed properties and emit a 'changed' event if any of them
have changed since the last time this function was called.

Notions are handled separately and do not need to be checked here.

**Kind**: instance method of [<code>SynchroItem</code>](#SynchroItem)  
**Emits**: [<code>changed</code>](#SynchroItem+event_changed)  
<a name="SynchroItem+event_changed"></a>

### "changed"
**Kind**: event emitted by [<code>SynchroItem</code>](#SynchroItem)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| property | <code>string</code> | The name of the changed property. |
| old_value | <code>\*</code> | The previous value of the property. |
| new_value | <code>\*</code> | The new value of the property. |

<a name="SynchroSet"></a>

## SynchroSet
**Kind**: global class  

* [SynchroSet](#SynchroSet)
    * [new SynchroSet(my_class)](#new_SynchroSet_new)
    * [.transmit](#SynchroSet+transmit)
    * [.transmit](#SynchroSet+transmit) ⇒ <code>function</code>
    * [.receive(str)](#SynchroSet+receive)
    * [.add(item)](#SynchroSet+add)
    * [.remove(item)](#SynchroSet+remove)
    * [.find(id)](#SynchroSet+find) ⇒ <code>Class</code>
    * ["added"](#SynchroSet+event_added)
    * ["removed"](#SynchroSet+event_removed)
    * ["changed"](#SynchroSet+event_changed)

<a name="new_SynchroSet_new"></a>

### new SynchroSet(my_class)
SynchroSet manages a class of objects


| Param | Type | Description |
| --- | --- | --- |
| my_class | <code>Class</code> | the class of objects we are managing |

<a name="SynchroSet+transmit"></a>

### synchroSet.transmit
Set the transmit function to be used to send changes to remote listeners

**Kind**: instance property of [<code>SynchroSet</code>](#SynchroSet)  
**Throws**:

- <code>TypeError</code> if the function is not a function


| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | function that takes an event name and payload to transmit. Set to null to disable transmission. |

<a name="SynchroSet+transmit"></a>

### synchroSet.transmit ⇒ <code>function</code>
Get the transmit function

**Kind**: instance property of [<code>SynchroSet</code>](#SynchroSet)  
**Returns**: <code>function</code> - the transmit function  
<a name="SynchroSet+receive"></a>

### synchroSet.receive(str)
Handle incoming events from remote listeners

**Kind**: instance method of [<code>SynchroSet</code>](#SynchroSet)  

| Param | Type |
| --- | --- |
| str | <code>string</code> | 

<a name="SynchroSet+add"></a>

### synchroSet.add(item)
Add an item to the master set

**Kind**: instance method of [<code>SynchroSet</code>](#SynchroSet)  
**Throws**:

- <code>TypeError</code> if the item is not an instance of the class we are managing
- <code>Error</code> if the item already exists in the master set


| Param | Type | Description |
| --- | --- | --- |
| item | <code>Class</code> | item that is an instance of the class we are managing |

<a name="SynchroSet+remove"></a>

### synchroSet.remove(item)
Remove an item from the master set

**Kind**: instance method of [<code>SynchroSet</code>](#SynchroSet)  

| Param | Type | Description |
| --- | --- | --- |
| item | <code>Class</code> \| <code>string</code> | the item to remove, or its ID |

<a name="SynchroSet+find"></a>

### synchroSet.find(id) ⇒ <code>Class</code>
Find an item by its ID

**Kind**: instance method of [<code>SynchroSet</code>](#SynchroSet)  
**Returns**: <code>Class</code> - the item with the given ID  
**Throws**:

- <code>TypeError</code> if the ID is not a string


| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | the ID of the item to find |

<a name="SynchroSet+event_added"></a>

### "added"
**Kind**: event emitted by [<code>SynchroSet</code>](#SynchroSet)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| item | [<code>SynchroItem</code>](#SynchroItem) | The item that was added |

<a name="SynchroSet+event_removed"></a>

### "removed"
**Kind**: event emitted by [<code>SynchroSet</code>](#SynchroSet)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| item | [<code>SynchroItem</code>](#SynchroItem) | The item that was removed |

<a name="SynchroSet+event_changed"></a>

### "changed"
**Kind**: event emitted by [<code>SynchroSet</code>](#SynchroSet)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| item | [<code>SynchroItem</code>](#SynchroItem) | The item that was changed |
| event | <code>SynchroItem#changed</code> | The change event from the item |

