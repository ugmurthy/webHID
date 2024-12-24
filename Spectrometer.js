// Spectrometer.js

export class Spectrometer {
    constructor(vendorId, productId) {
        this.vendorId = vendorId;
        this.productId = productId;
        this.device = null;
        this.isConnected = false;
    }

    /**
     * Connects to the HID device.
     * @throws Will throw an error if the device cannot be connected.
     */
    async connect() {
        try {
            console.log("Connecting to HID device...",this.vendorId,this.productId);
            const devices = await navigator.hid.requestDevice({
                filters: [{ vendorId: this.vendorId, productId: this.productId }]
            });

            if (devices.length === 0) {
                throw new Error('No HID device found.');
            }

            this.device = devices[0];
            await this.device.open();
            this.isConnected = true;
            console.log('Connected to HID device');
        } catch (error) {
            this.isConnected = false;
            console.error('Failed to connect to the spectrometer:', error);
            throw error;
        }
    }

    /**
     * Get the file size and fetch the file data in chunks.
     * @param {number} fileToRead - The file identifier.
     * @returns {Promise<Uint8Array>} The entire file data.
     * @throws Will throw an error if the file cannot be read.
     */
    async getFile(fileToRead) {
        if (!this.isConnected) {
            throw new Error('Device is not connected.');
        }
        console.log('fileToRead...',fileToRead);
        // Step 1: Request the file size
        console.log('Fetching file size...');
        
        const dataSize = await this.receiveCommand(0x00, 0x2D, [fileToRead]);
        console.log("Data size: ", dataSize);

        // Step 2: Reverse and combine the data size (shiftBytes equivalent)
        dataSize.reverse();
        console.log("Data size reversed: ", dataSize);
        const dataSizeCombined = this.shiftBytes(dataSize);
        console.log("Data size combined: ", dataSizeCombined);

        // Step 3: Fetch the file in chunks
        console.log('Fetching file data...');
        let fileData = [];
        let totalBytesRead = 0;


        // Continue reading until the entire file is fetched
        while (totalBytesRead < dataSizeCombined) {
            const chunk = await this.receiveCommand(0x00, 0x2E);
            fileData = [...fileData, ...chunk];
            totalBytesRead += chunk.length;
            console.log(`Received chunk, current total: ${totalBytesRead} bytes`);
            console.log(" datasizecombined", dataSizeCombined);
        }
        console.log("File data received, total length:");
        // console.log("File data received, total length:", fileData.length);
        // console.log("Expected file length:", dataSizeCombined);

        return fileData;
    }

    /**
     * Perform the scan operation.
     * @returns {Promise<Uint8Array>} Scan data.
     * @throws Will throw an error if scan cannot be performed.
     */
    async performScan() {
        if (!this.isConnected) {
            throw new Error('Device is not connected.');
        }

        console.log('Starting scan...');
        try {
            // Send command to start scan
            await this.sendCommand(0x02, 0x18, [0x00]);  // Start scan command
            console.log('Scan started.');
        } catch (error) {
            console.error('Error during scanning:', error);
            throw error;
        }
    }

    /**
     * Get current configuration from the spectrometer.
     * @returns {Promise<Object>} Parsed configuration data.
     * @throws Will throw an error if the configuration cannot be fetched.
     */
    async getConfiguration() {
        if (!this.isConnected) {
            throw new Error('Device is not connected.');
        }

        console.log('Fetching current configuration...');
        try {
            // Send the command to get the active scan configuration
            const configData = await this.receiveCommand(0x02, 0x23);  // Read active scan configuration
            console.log('Configuration Response:', configData);

            // Example: You can parse the configData into a readable format
            const parsedConfig = this.parseConfigurationData(configData);
            console.log('Parsed Configuration:', parsedConfig);
            return parsedConfig;
        } catch (error) {
            console.error('Error fetching configuration:', error);
            throw error;
        }
    }

    /**
     * Parse the configuration data returned by the device.
     * @param {Uint8Array} data - Raw data received from the device.
     * @returns {Object} Parsed configuration.
     */
    parseConfigurationData(data) {
        return {
            scanType: data[0],       // Example: Scan type (e.g., 0x01)
            numRepeats: data[1],     // Number of scan repeats
            exposureTime: data[2],   // Exposure time in ms
            wavelengthStart: data[3],// Starting wavelength in nm
            wavelengthEnd: data[4],  // Ending wavelength in nm
        };
    }

    /**
     * Send a USB command to the spectrometer.
     * @param {number} groupByte - The group byte of the command.
     * @param {number} commandByte - The command byte.
     * @param {Array<number>} [data=[]] - The data to be sent with the command.
     * @throws Will throw an error if the command cannot be sent.
     */
    async sendCommand(groupByte, commandByte, data = []) {
        const reportId = 0x00;
        const payload = new Uint8Array([
            0x40,  // Flags (Write, wants a reply)
            0x00,  // Sequence Byte
            data.length + 2,  // Data length (LSB)
            0x00,  // Data length (MSB)
            commandByte,  // Command byte
            groupByte,  // Group byte
            ...data  // Additional data
        ]);

        console.log(`Sending command: ${this.hexify(payload)}`);
        try {
            await this.device.sendReport(reportId, payload);
            await this.waitForResponse();
        } catch (error) {
            console.error('Failed to send command:', error);
            throw error;
        }
    }

    /**
     * Waits briefly for the device to process the command.
     */
    async waitForResponse() {
        // Wait for a brief moment to allow the device to process the command
        await new Promise(resolve => setTimeout(resolve, 10));  // Wait for 10ms
    }

    /**
     * Receives a command response from the device.
     * @param {number} groupByte - The group byte of the command.
     * @param {number} commandByte - The command byte.
     * @param {Array<number>} [data=[]] - The data to be sent with the command.
     * @returns {Promise<Uint8Array>} The response data from the device.
     */
    async receiveCommand(groupByte, commandByte, data = []) {
        console.log("Reading Command");

        // Prepare the command payload (similar to Python code)
        const reportId = 0x00;
        const payload = new Uint8Array([
            0xC0,  // Flags Byte (1100 0000) - Read, wants a reply
            0x00,  // Sequence Byte (set to 0)
            data.length + 2,  // Length of data (LSB)
            0x00,  // Length of data (MSB) - not used here
            commandByte,  // Command Byte
            groupByte,  // Group Byte
            ...data,  // Additional data if any
        ]);

        console.log(`Sending command: ${this.hexify(payload)}`);

        try {
            // Send the command to the device
            await this.device.sendReport(reportId, payload);
            console.log("Command sent, waiting for response...");
            await this.waitForResponse();  // Wait a bit for the device to process the command
        } catch (error) {
            console.error('Failed to send command:', error);
            throw error;
        }

        let readData = [];
        const timeout = 10000;  // Timeout duration set to 10 seconds

        // Fetch response from the device
        const responseData = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject('Timeout waiting for response'), timeout);

            this.device.addEventListener("inputreport", (event) => {
                clearTimeout(timer);
                let responseChunk = new Uint8Array(event.data.buffer);
                readData = readData.concat(Array.from(responseChunk));  // Concatenate received data

                // Once we have received the first part of the response, check the size
                if (readData.length >= 4) {
                    const header = readData.slice(0, 4);
                    const dataLength = (header[3] << 8) | header[2];  // Combine MSB and LSB for length
                    console.log("Data length received:", dataLength);

                    if (readData.length >= dataLength + 4) {
                        resolve(readData);  // Full data received
                    }
                }
            });
        });

        console.log("Received Data:", this.hexify(responseData));

        // Process received data
        const header = responseData.slice(0, 4);
        const dataLength = (header[3] << 8) | header[2];
        let dataRequested;

        if (dataLength > 60) {
            // If the response is larger than 60 bytes, read in chunks
            let remainingLength = dataLength - 60;
            dataRequested = responseData.slice(4);
            while (remainingLength > 0) {
                const additionalData = await new Promise((resolve, reject) => {
                    let innerTimeout = setTimeout(() => reject('Timeout waiting for additional data'), 5000);
                    this.device.addEventListener("inputreport", (innerEvent) => {
                        clearTimeout(innerTimeout);
                        const chunk = new Uint8Array(innerEvent.data.buffer);
                        resolve(chunk);
                    });
                });
                dataRequested = new Uint8Array([...dataRequested, ...additionalData]);
                remainingLength -= additionalData.length;
            }
        } else {
            // If the data is less than 60 bytes, we can directly extract it
            dataRequested = responseData.slice(4, 4 + dataLength);
        }

        console.log("Data Requested:", this.hexify(dataRequested));
        return dataRequested;
    }

    /**
     * Converts a byte array to a hexadecimal string for logging.
     * @param {Uint8Array} array - The byte array to convert.
     * @returns {string} The hexadecimal string.
     */
    hexify(array) {
        return Array.from(array).map(byte => byte.toString(16).padStart(2, '0')).join(' ');
    }

    /**
     * Combines an array of bytes into an integer, similar to Python's shiftBytes.
     * @param {Uint8Array} list - The array of bytes to combine.
     * @returns {number} The combined integer value.
     */
    shiftBytes(list) {
        let sumToReturn = 0;
        console.log("List: ", list);    
        for (let i = 0; i < list.length; i++) {
            sumToReturn += list[i] << ((list.length - 1 - i) * 8);
        }
        return sumToReturn;
    }
}
