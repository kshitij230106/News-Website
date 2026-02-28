const API_KEY = 'pub_933c9656e75c41578a4d8267862182f6';
const sizes = [10, 20, 30, 50];

async function testSizes() {
    for (let s of sizes) {
        const res = await fetch(`https://newsdata.io/api/1/latest?apikey=${API_KEY}&language=en&size=${s}`);
        const data = await res.json();
        console.log(`Size ${s}:`, data.status === 'success' ? `Success (${data.results.length} articles)` : `Error: ${data.message || (data.results && data.results.message)}`);
    }
}
testSizes();
