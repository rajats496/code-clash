import axios from 'axios';

const res = await axios.post('https://emkc.org/api/v2/piston/execute', {
  language: 'python',
  version: '*',
  files: [{ content: "n=int(input())\nprint('YES' if n%2==0 and n>2 else 'NO')" }],
  stdin: '4',
}, { timeout: 12000 });

console.log(JSON.stringify(res.data, null, 2));
