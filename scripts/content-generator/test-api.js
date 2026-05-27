const date = '2026-05-28';
Promise.all([
    fetch(`https://www.nytimes.com/svc/wordle/v2/${date}.json`).then(r => r.json()).catch(e => e.message),
    fetch(`https://www.nytimes.com/svc/strands/v2/${date}.json`).then(r => r.json()).catch(e => e.message)
]).then(results => {
    console.log("Wordle:", JSON.stringify(results[0], null, 2));
    console.log("Strands:", JSON.stringify(results[1], null, 2));
});
