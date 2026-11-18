// jsdom is a fake browser used in tests and doesnt support <dialog> modals yet. 
//these are stand-ins. 
import { afterEach } from "vitest"
import { cleanup } from '@testing-library/react'


if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
        this.open = true; 
    }
    HTMLDialogElement.prototype.close = function() {
        this.open = false; 
    }

}

//remove rendered page after each test so other tests dont fail. 
afterEach(() => {
    cleanup()
})