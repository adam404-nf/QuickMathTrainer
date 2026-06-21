# Questions

Owns the Question Engine.

Responsibilities:

- Define the standard question shape and metadata.
- Generate questions through controlled randomness.
- Keep generators independent from React and UI.
- Register available question types through a central registry.
- Validate generated questions with constraints before they reach practice sessions.

Generation flow:

```text
Practice Session requests next question
-> Registry selects question type
-> Generator selects template
-> Template creates candidate question
-> Constraints validate mentalCost, difficulty, and repetition
-> Valid Question is returned
```

Use `mentalCost` from 1 to 5 to represent how suitable a question is for mental calculation.
