# TODO

## Gui
- Remove narrator from gui (and game defintion)
- Only characters displayed in game window (no narrator), they will size dynamically if selected and expand into chat window.  This is difficult to design and needs careful consideration and thought.
- No @ to specific characters, you choose their window to talk to them.
- remove unnecessary noise, no reptition of text in gui elements, no start/continue button just one link 
- Better styling aesthetic, maybe use a cleaner less ornate font.

## Payment
- include stripelink payments
- mininum $5 which buys 500 credits
- user profile shows how many credits left
- credits reduce based on token usage, will need token estimator for each query, and cost per token. Cost per token can be found from model name and model platform web search.

## crypto
- Allow entering of keys for crypto prizes during game definition, as simple text.
- specific prize input text field, then verifies that text is a crypto key (evm ethereum, base arbitirum, or hypeevm) 
- Also verifies that the key itself is somewhere in the chracter prompts
- check amount in wallet, peridocially checks that amount is still there
- add to game display verfied prize amount

## Game engine
- game creator can edit game definition
- games can be copied
- no narrator
- the user is a specific character

## Long Term
- Automated game creation/testing
- Mobile app using react native and expo
