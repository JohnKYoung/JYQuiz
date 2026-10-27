# Use-Case Diagram

This diagram shows the player's interactions with John's Quiz Site and the site's external services.

```mermaid
flowchart LR
    player([Player])
    trivia[(Open Trivia Database)]
    browser[(Browser localStorage)]
    audio[(Web Audio API)]

    subgraph site["John's Quiz Site"]
        browse([Browse quiz subjects])
        search([Search subjects])
        difficulty([Choose difficulty])
        start([Start quiz])
        answer([Answer timed questions])
        feedback([View answer feedback])
        results([View quiz results])
        review([Review answers])
        retry([Retry quiz])
        changeSubject([Choose another subject])
        viewScores([View high scores])
        clearScores([Clear score history])
        theme([Switch light or dark theme])
        toggleSound([Toggle sound])
        saveScore([Save completed score])
        fallback([Use sample data when API is unavailable])
    end

    player --> browse
    player --> search
    player --> difficulty
    player --> start
    player --> answer
    player --> feedback
    player --> results
    player --> review
    player --> retry
    player --> changeSubject
    player --> viewScores
    player --> clearScores
    player --> theme
    player --> toggleSound

    browse <--> trivia
    start <--> trivia
    trivia -. request fails or returns no questions .-> fallback
    fallback -. supplies categories .-> browse
    fallback -. supplies questions .-> start

    start -. begins .-> answer
    answer -. answer selected or timer expires .-> feedback
    answer -. final question completed .-> results
    results -. includes .-> review
    results -. records .-> saveScore
    saveScore --> browser
    viewScores <--> browser
    clearScores --> browser
    toggleSound -. generates optional sound .-> audio
```

## Use-case notes

- The player browses and searches categories, chooses a difficulty, and starts a quiz.
- The player answers timed questions and receives feedback for selected answers or timeouts.
- Completing the quiz displays the score and answer review, then saves the result in browser storage.
- The player can retry, choose a different subject, view saved scores, or clear score history.
- The Open Trivia Database provides categories and questions. Built-in sample data is used when the API is unavailable or returns no questions.
- Sound effects use the browser's Web Audio API when enabled. Theme selection is handled within the app.
