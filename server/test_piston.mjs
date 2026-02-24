const code = `#include <iostream>
int main() {
    std::cout << "Hello C++";
    return 0;
}`;

fetch('http://localhost:2000/api/v2/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        language: 'c++',
        version: '*',
        files: [{ content: code }]
    })
})
    .then(r => r.json())
    .then(console.log)
    .catch(console.error);
