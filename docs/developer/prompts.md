# Prompts asked in this conversation

This file records the user prompts from the current conversation.
Model used for this conversation: GPT-5.4

## Prompt 1
**Model:** GPT-5.4

> I'm planning to build an app.
>
> “The Hat” – Quick Rules  
> Setup: Host creates a room, sets number of words per player, and turn timer. Sends invite link to players. Each player join the room, enters his name, adds their words.
>
> Turns: Players take turns clockwise. Current player explains, the player on their left guesses. Words cannot be skipped.
>
> Scoring: Each guessed word gives +1 point to both explainer and guesser. Words are removed only for that round.
>
> Rounds:
>
> Round 1: Explain normally, no synonyms.  
> Round 2: Gestures only, no speaking.  
> Round 3: One word only, no synonyms.  
> All rounds use the same words, reshuffled each round.
> End: Round ends when all words are guessed. After Round 3, the final scores are shown.
>
> I would like to build this app using .net + react.
>
> First of all I would like you to create a list of issues(I'm working in github) to implement this app.
>
> Before you start, please ask top 10 major question you need to know before you create list of issues

## Prompt 2
**Model:** GPT-5.4

> Do you need to know something else from me or you have already enoguh info? Are rules and flows clear for you? Everything is understandable?

## Prompt 3
**Model:** GPT-5.4

> 1) how “clockwise” is represented in the UI/player order - good question. Let's do it in such way, Host has 2 options, randomly build player order (e.g. 1-8) or order player on his own  
> 2) whether host can edit settings after players join, can edit  
> 3) duplicate words are allowed  
> 4) if timer expires mid-word, this word is treated as not guessed and goes back into virtual hat  
> 5) by name only using case-independence and trimming white spaces  
> 6) host is also normal player
>
> I like your questions, do you want to ask something else?

## Prompt 4
**Model:** GPT-5.4

> Keep defaults
>
> anything else?

## Prompt 5
**Model:** GPT-5.4

> Create a file under folder docs/features.md and use step 3

## Prompt 6
**Model:** GPT-5.4

> Now, create a file in docs/developer/prompts.md. This file will contain all prompts that I ask you. put here all my prompts that I asked you in current conversation
>
> Also, add copilot instuctions file with instructions required for my project and instruction that Copilot(you) always need to update prompts.md file with my promts

## Prompt 7
**Model:** GPT-5.4

> Can we also insert into prompt history what LLM model was used for my prompt?

## Prompt 8
**Model:** GPT-5.4

> make initial commit

## Prompt 9
**Model:** GPT-5.4

> push my branch

## Prompt 10
**Model:** GPT-5.4

> add one more file into docs where you'll track what issue already done

## Prompt 11
**Model:** GPT-5.4

> add copilot prompt file which I'll use to start executing of  issues.
> This prompt file should contain following prompts(you can adjust for better readiness)
>
> Take a look at features.md file and implement the issues provided (issue number/numbers will be provideded afyer /...).
> When the issue is implemented update issue-status.md file

## Prompt 12
**Model:** GPT-5.4

> you maybe misunderstood, this is copilot feature and placed under .github/prompts/*.prompt.md
