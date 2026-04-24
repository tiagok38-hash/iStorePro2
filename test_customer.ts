import { addCustomer } from './services/customerService.ts';
async function test() {
    try {
        const res = await addCustomer({ name: 'Test Customer', phone: '11999999999' });
        console.log('Success:', res);
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
