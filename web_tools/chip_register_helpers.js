// Helper Functions for Register Manipulation

function hexToDec(hex) {
    // Converts a hex string to its decimal equivalent. Returns NaN if invalid.
    return parseInt(hex, 16);
}

function decToHex(dec, padding = 4) {
    // Converts a decimal number to its hex string representation, padded with leading zeros.
    if (isNaN(dec)) return ''.padStart(padding, '0'); // Handle NaN input gracefully
    return dec.toString(16).toUpperCase().padStart(padding, '0');
}

function decToBinary(dec, padding = 16) {
    // Converts a decimal number to its binary string representation, padded with leading zeros.
    if (isNaN(dec)) return ''.padStart(padding, '0'); // Handle NaN input gracefully
    return dec.toString(2).padStart(padding, '0');
}

function binaryToDec(bin) {
    // Converts a binary string to its decimal equivalent.
    return parseInt(bin, 2);
}

function formatBinary(bin) {
    // Adds spaces every 4 bits in a binary string for readability.
    return bin.match(/.{1,4}/g)?.join(' ') || '';
}

function getBit(value, bit) {
    // Gets the value (0 or 1) of a specific bit in a decimal number.
    return (value >> bit) & 1;
}

function setBit(value, bit) {
    // Sets a specific bit to 1 in a decimal number.
    return value | (1 << bit);
}

function clearBit(value, bit) {
    // Clears a specific bit to 0 in a decimal number.
    return value & ~(1 << bit);
}

function updateBit(value, bit, bitValue) {
    // Sets or clears a specific bit based on the bitValue (true/1 or false/0).
    return bitValue ? setBit(value, bit) : clearBit(value, bit);
}

function getMultiBitValue(value, bits) {
    // Extracts a value represented by multiple, potentially non-contiguous bits.
    // 'bits' array should be ordered from MSB to LSB as they appear in the register definition.
    let result = 0;
    for (let i = 0; i < bits.length; i++) {
        const bitPosition = bits[i];
        const bitValue = getBit(value, bitPosition);
        // Shift the result left and add the new bit at the LSB position
        result = (result << 1) | bitValue;
    }
    return result;
}

function setMultiBitValue(currentValue, bits, newValue) {
    // Sets multiple, potentially non-contiguous bits to represent newValue.
    // 'bits' array should be ordered from MSB to LSB.
    let updatedValue = currentValue;
    for (let i = 0; i < bits.length; i++) {
        // Process bits from LSB of newValue to MSB of the 'bits' array definition
        const bitPosition = bits[bits.length - 1 - i];
        const bitValue = (newValue >> i) & 1; // Get the i-th bit of the newValue
        updatedValue = updateBit(updatedValue, bitPosition, bitValue);
    }
    return updatedValue;
}

// Core Update Logic
function updateFromHex(registerId, registers) {
    const registerData = registers[registerId];
    const container = document.getElementById(`register-${registerId}`);
    const hexInput = container.querySelector('.hex-input');
    const binaryDisplay = container.querySelector('.binary-display');
    const tableBody = container.querySelector('tbody');

    let hexValue = hexInput.value.toUpperCase().replace(/[^0-9A-F]/g, ''); // Sanitize input
    hexInput.value = hexValue; // Update input field with sanitized value

    let decValue = 0; // Default to 0 if input is empty or invalid

    if (hexValue.length > 0) {
        if (hexValue.length > 4) {
            hexValue = hexValue.substring(0, 4);
            hexInput.value = hexValue;
        }
        decValue = hexToDec(hexValue.padStart(4, '0'));
        if (isNaN(decValue)) {
            decValue = 0;
        }
    }

    const binaryValue = decToBinary(decValue);
    binaryDisplay.textContent = formatBinary(binaryValue);

    // Update bit controls
    registerData.fields.forEach(field => {
        const bitIdentifier = field.bit !== undefined ? field.bit.toString() : field.bits.join(',');
        const control = tableBody.querySelector(`[data-bit="${bitIdentifier}"]`);
        if (!control) return;

        if (field.type === 'checkbox') {
            const bitValue = getBit(decValue, field.bit);
            control.checked = bitValue === 1;
        } else if (field.type === 'select') {
            if (field.bits) { // <-- Add this check
                const multiBitVal = getMultiBitValue(decValue, field.bits);
                // Ensure the value exists as an option before setting, prevent errors
                if (control.querySelector(`option[value="${multiBitVal}"]`)) {
                     control.value = multiBitVal.toString();
                } else {
                     console.warn(`Calculated value ${multiBitVal} not found in options for select field ${field.name}. Setting to default.`);
                     control.value = "0"; // Or find the default/first option value
                }
            } else {
                // Log an error if a 'select' field is missing 'bits'
                console.error(`Select field '${field.name}' is missing the 'bits' property definition.`);
                control.value = "0"; // Set to a default value
            }
        } else if (field.type === 'display') {
            let displayValue;
            if (field.bit !== undefined) {
                displayValue = getBit(decValue, field.bit);
            } else {
                displayValue = getMultiBitValue(decValue, field.bits);
                control.textContent = `0x${decToHex(displayValue, Math.ceil(field.bits.length / 4))}`;
                return;
            }
            control.textContent = displayValue === 1 ? "True" : "False";
        } else if (field.type === 'reserved') {
            // Find the control element using the correct identifier (single or multi-bit)
            const bitIdentifier = field.bit !== undefined ? field.bit.toString() : (field.bits ? field.bits.join(',') : null);
            if (!bitIdentifier) {
                console.error(`Reserved field ${field.name} has invalid identifier.`);
                return; // Skip this field if identifier is bad
            }
            const control = tableBody.querySelector(`[data-bit="${bitIdentifier}"]`);
            if (!control) {
                console.error(`Could not find control element for reserved field: ${field.name} with identifier: ${bitIdentifier}`);
                return; // Skip this field if control element is not found
            }

            let reservedValue;
            let isSingleBit = false;

            // Check if it's a single bit reserved field
            if (field.bit !== undefined) {
                reservedValue = getBit(decValue, field.bit);
                isSingleBit = true;
                // Else, check if it's a multi-bit reserved field
            } else if (field.bits) {
                reservedValue = getMultiBitValue(decValue, field.bits);
                // Else, it's an invalid definition for a reserved field
            } else {
                console.error(`Reserved field ${field.name} has neither 'bit' nor 'bits' defined.`);
                control.textContent = '?'; // Indicate configuration error
                control.classList.remove('reserved-non-zero');
                return; // Skip to the next field
            }

            // Now update the display based on the reservedValue
            if (reservedValue === 0) {
                control.textContent = ''; // Display nothing if zero
                control.classList.remove('reserved-non-zero'); // Ensure red class is removed
            } else {
                // Value is non-zero, display in red
                if (isSingleBit) {
                    // For a single bit, the non-zero value is always 1
                    control.textContent = '1';
                } else {
                    // For multiple bits, display the value in hex
                    const hexPadding = Math.ceil(field.bits.length / 4);
                    control.textContent = `0x${decToHex(reservedValue, hexPadding)}`;
                }
                control.classList.add('reserved-non-zero'); // Add red class
            }
        }
    });
}

function updateFromBits(registerId, registers) {
    const registerData = registers[registerId];
    if (registerData.isReadOnly) return;

    const container = document.getElementById(`register-${registerId}`);
    const hexInput = container.querySelector('.hex-input');
    const binaryDisplay = container.querySelector('.binary-display');
    const tableBody = container.querySelector('tbody');

    let currentDecValue = 0;

    registerData.fields.forEach(field => {
        if (field.type === 'display') return;

        const bitIdentifier = field.bit !== undefined ? field.bit.toString() : field.bits.join(',');
        const control = tableBody.querySelector(`[data-bit="${bitIdentifier}"]`);
        if (!control) return;

        if (field.type === 'checkbox') {
            if (control.checked) {
                currentDecValue = setBit(currentDecValue, field.bit);
            }
        } else if (field.type === 'select') {
            const selectedValue = parseInt(control.value, 10);
            currentDecValue = setMultiBitValue(currentDecValue, field.bits, selectedValue);
        }
    });

    const hexValue = decToHex(currentDecValue);
    const binaryValue = decToBinary(currentDecValue);

    hexInput.value = hexValue;
    binaryDisplay.textContent = formatBinary(binaryValue);
}

function clearBitControls(registerId, registers) {
    const registerData = registers[registerId];
    const container = document.getElementById(`register-${registerId}`);
    const tableBody = container.querySelector('tbody');

    registerData.fields.forEach(field => {
        const bitIdentifier = field.bit !== undefined ? field.bit.toString() : field.bits.join(',');
        const control = tableBody.querySelector(`[data-bit="${bitIdentifier}"]`);
        if (!control) return;

        if (field.type === 'checkbox') {
            control.checked = false;
        } else if (field.type === 'select') {
            control.value = "0";
        } else if (field.type === 'display') {
            if (field.bits) {
                control.textContent = `0x${'0'.padStart(Math.ceil(field.bits.length / 4), '0')}`;
            } else {
                control.textContent = 'False';
            }
        } else if (field.type === 'reserved') {
            control.textContent = '';
            control.classList.remove('reserved-non-zero');
        }
    });
}
