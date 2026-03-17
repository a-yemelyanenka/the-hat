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

## Prompt 13
**Model:** GPT-5.4

> Follow instructions in [implement-issues.prompt.md](file:///d%3A/Repos/the-hat/.github/prompts/implement-issues.prompt.md).
>
> 1

## Prompt 14
**Model:** GPT-5.4

> coninue where you stopped

## Prompt 15
**Model:** GPT-5.4

> code reivew
>
> 1) put c# sln into backed folder
> 2) use new slnx format

## Prompt 16
**Model:** GPT-5.4

> implement a new custom prompt
>
> prompt:
> take a look at issue-status.md and features.md => # Suggested implementation order and give me next 10 issue that needed to be implemented in format
> Epic 1 issue 1
> Epic 1 issue 3
> etc.

## Prompt 17
**Model:** GPT-5.4

> <attachment id="prompt:next-issues.prompt.md" filePath="d:\Repos\the-hat\.github\prompts\next-issues.prompt.md">
> Prompt instructions file:
> # List next backlog issues
>
> Take a look at [docs/issue-status.md](../../docs/issue-status.md) and the [Suggested implementation order](../../docs/features.md#suggested-implementation-order) in [docs/features.md](../../docs/features.md), then list the next 10 issues that should be implemented.
>
> ## Instructions
> - Use the suggested implementation order from [docs/features.md](../../docs/features.md).
> - Cross-check current completion state in [docs/issue-status.md](../../docs/issue-status.md).
> - Skip issues already marked as done.
> - Prefer issues not started or in progress.
> - Return exactly the next 10 remaining issues in backlog order, or fewer if fewer remain.
> - Format each result on its own line as:
>   - `Epic 1 issue 1`
>   - `Epic 1 issue 3`
> - Do not include descriptions, bullets, numbering, or extra commentary.
>
> ## Expected workflow
> 1. Read [docs/issue-status.md](../../docs/issue-status.md).
> 2. Read the [Suggested implementation order](../../docs/features.md#suggested-implementation-order) in [docs/features.md](../../docs/features.md).
> 3. Filter out completed issues.
> 4. Output the next 10 issues in the required format.
>
> </attachment>
> Follow instructions in [next-issues.prompt.md](file:///d%3A/Repos/the-hat/.github/prompts/next-issues.prompt.md).

## Prompt 18
**Model:** GPT-5.4

> <attachment id="prompt:implement-issues.prompt.md" filePath="d:\Repos\the-hat\.github\prompts\implement-issues.prompt.md">
> Prompt instructions file:
> # Implement backlog issues
>
> Take a look at [docs/features.md](../../docs/features.md) and implement the issue or issues provided after `/`.
>
> ## Instructions
> - Read the requested issue definitions in [docs/features.md](../../docs/features.md).
> - Implement only the requested issue scope.
> - Keep changes minimal and focused.
> - Follow the project guidance in [copilot-instructions.md](../copilot-instructions.md).
> - Add or update tests when the issue changes core logic or state transitions.
> - Keep documentation aligned with the implementation.
> - When the issue is implemented, update [docs/issue-status.md](../../docs/issue-status.md).
> - Also update [docs/developer/prompts.md](../../docs/developer/prompts.md) with the latest user prompt and model.
>
> ## Usage examples
> - `/1`
> - `/6,8,9`
> - `/19-24`
>
> ## Expected workflow
> 1. Read the matching issues in [docs/features.md](../../docs/features.md).
> 2. Identify the affected files.
> 3. Implement the requested issues.
> 4. Validate the changes.
> 5. Update [docs/issue-status.md](../../docs/issue-status.md).
> 6. Summarize completed work and any follow-up items.
>
> </attachment>
> Follow instructions in [implement-issues.prompt.md](file:///d%3A/Repos/the-hat/.github/prompts/implement-issues.prompt.md).
>
> 2-5

## Prompt 19
**Model:** GPT-5.4

> refactor current backend
>
> 1) create separate folders with projects for, don't forget to move all files approriatly
> Api
> Domain
> Persistance
> Contracts
> 2) No need to implement repository pattern, use DbContext Directly. Models that used in DbContext should be the same as used in Domain

## Prompt 20
**Model:** GPT-5.4

> Domain will need to access DbContext. Let's do the following
> Domain should contain interface IApplicationDbContext with required DbSets
> and Persistance DbContext implements this interface
> DI happens on Api layer
