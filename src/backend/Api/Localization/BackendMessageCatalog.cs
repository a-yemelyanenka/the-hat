using System.Text.RegularExpressions;
using TheHat.Backend.Contracts;

namespace TheHat.Backend.Api.Localization;

internal static partial class BackendMessageCatalog
{
    private static readonly IReadOnlyDictionary<string, string> ExactMessageKeys = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["The host display name is required."] = "backend.roomFactory.hostDisplayNameRequired",
        ["Words per player must be greater than zero."] = "backend.roomFactory.wordsPerPlayerPositive",
        ["Turn duration must be greater than zero."] = "backend.roomFactory.turnDurationPositive",
        ["A supported player order mode is required."] = "backend.roomFactory.playerOrderModeRequired",
        ["The display name is required."] = "backend.join.displayNameRequired",
        ["This display name is already taken in the room."] = "backend.join.displayNameTaken",
        ["No player with this display name was found in the room."] = "backend.join.rejoinCandidateNotFound",
        ["The player could not be found in this room."] = "backend.room.playerNotFound",
        ["Words can only be viewed or edited before the game starts."] = "backend.wordSubmission.lobbyOnly",
        ["Inactive players cannot submit words."] = "backend.wordSubmission.inactivePlayer",
        ["The submitted words are required."] = "backend.wordSubmission.wordsRequired",
        ["Words cannot be empty or whitespace."] = "backend.wordSubmission.wordEmpty",
        ["Only the host can update room settings."] = "backend.lobby.hostOnlyUpdateSettings",
        ["Room settings can only be changed before the game starts."] = "backend.lobby.settingsBeforeGameStart",
        ["Manual player order can only be supplied when manual ordering is selected."] = "backend.lobby.manualOrderRequiresManualMode",
        ["Only the host can start the game."] = "backend.lobby.hostOnlyStartGame",
        ["The game has already started."] = "backend.lobby.gameAlreadyStarted",
        ["Manual player order must include every player exactly once."] = "backend.lobby.manualOrderMustIncludeEveryPlayer",
        ["The game can only be started from the lobby."] = "backend.lobby.phaseLobbyOnly",
        ["At least two active players are required to start the game."] = "backend.lobby.minActivePlayers",
        ["A valid player identifier is required to load gameplay."] = "backend.gameplay.loadPlayerRequired",
        ["A valid player identifier is required to start the turn."] = "backend.gameplay.startTurnPlayerRequired",
        ["A valid player identifier is required to confirm a guess."] = "backend.gameplay.confirmGuessPlayerRequired",
        ["A valid player identifier is required to end the current turn."] = "backend.gameplay.endTurnPlayerRequired",
        ["A valid player identifier is required to reactivate presence."] = "backend.gameplay.reactivatePlayerRequired",
        ["A valid player identifier is required to deactivate presence."] = "backend.gameplay.deactivatePlayerRequired",
        ["Only the active explainer can confirm a guessed word."] = "backend.gameplay.onlyActiveExplainerCanConfirm",
        ["Only the next explainer can start the prepared turn."] = "backend.gameplay.onlyPreparedExplainerCanStart",
        ["Only the active explainer can end an interrupted turn."] = "backend.gameplay.onlyActiveExplainerCanEndInterrupted",
        ["Only the host can pause the game."] = "backend.gameplay.hostOnlyPause",
        ["Only the host can resume the game."] = "backend.gameplay.hostOnlyResume",
        ["Only the host can continue to the next round."] = "backend.gameplay.hostOnlyContinueRound",
        ["A room must contain words before gameplay starts."] = "backend.gameplay.roomMustContainWords",
        ["At least two active players are required to start a game."] = "backend.gameplay.minActivePlayersToStart",
        ["The room is not waiting for the next explainer to start the turn."] = "backend.gameplay.awaitingTurnStartRequired",
        ["A turn cannot be started because the current round has no remaining words."] = "backend.gameplay.roundHasNoRemainingWordsStart",
        ["There are no words left to draw in the current round."] = "backend.gameplay.noWordsLeftToDraw",
        ["Guesses can only be confirmed during an active turn."] = "backend.gameplay.guessesOnlyDuringActiveTurn",
        ["A word must be active before it can be guessed."] = "backend.gameplay.activeWordRequired",
        ["The current turn can only be ended during active gameplay."] = "backend.gameplay.endTurnOnlyDuringActiveTurn",
        ["Turns can only expire during active gameplay."] = "backend.gameplay.expireOnlyDuringActiveTurn",
        ["The game can only be paused during an active turn."] = "backend.gameplay.pauseOnlyDuringActiveTurn",
        ["The game is not paused."] = "backend.gameplay.gameNotPaused",
        ["The room is not waiting to start the next round."] = "backend.gameplay.waitingForNextRound",
        ["The room does not have a completed round to continue from."] = "backend.gameplay.noCompletedRoundToContinue",
        ["The game has already completed all rounds."] = "backend.gameplay.allRoundsCompleted",
        ["Turns can only be prepared while the game is active."] = "backend.gameplay.prepareTurnOnlyWhileActive",
        ["A new turn cannot start because the current round has no remaining words."] = "backend.gameplay.newTurnRequiresRemainingWords",
        ["At least two active players are required to create a turn."] = "backend.gameplay.minActivePlayersToCreateTurn",
        ["The room does not contain any active players."] = "backend.gameplay.noActivePlayers",
        ["The room does not have an active round."] = "backend.gameplay.noActiveRound",
        ["The room does not have an active turn."] = "backend.gameplay.noActiveTurn",
    };

    public static LocalizedMessageDto ValidationFailed { get; } = new("backend.validationFailed", new Dictionary<string, string>(), "Validation failed.");

    public static LocalizedMessageDto Map(string message)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(message);

        if (ExactMessageKeys.TryGetValue(message, out var exactKey))
        {
            return Create(exactKey, message);
        }

        var exactWordsRequiredMatch = ExactWordsRequiredRegex().Match(message);
        if (exactWordsRequiredMatch.Success)
        {
            return Create(
                "backend.wordSubmission.exactWordsRequired",
                message,
                new Dictionary<string, string>(StringComparer.Ordinal)
                {
                    ["requiredCount"] = exactWordsRequiredMatch.Groups["requiredCount"].Value,
                });
        }

        var playerNeedsWordsMatch = PlayerNeedsWordsRegex().Match(message);
        if (playerNeedsWordsMatch.Success)
        {
            return Create(
                "backend.lobby.playerNeedsMoreWords",
                message,
                new Dictionary<string, string>(StringComparer.Ordinal)
                {
                    ["playerName"] = playerNeedsWordsMatch.Groups["playerName"].Value,
                    ["missingCount"] = playerNeedsWordsMatch.Groups["missingCount"].Value,
                    ["noun"] = playerNeedsWordsMatch.Groups["noun"].Value,
                });
        }

        var playerSubmittedTooManyWordsMatch = PlayerSubmittedTooManyWordsRegex().Match(message);
        if (playerSubmittedTooManyWordsMatch.Success)
        {
            return Create(
                "backend.lobby.playerSubmittedTooManyWords",
                message,
                new Dictionary<string, string>(StringComparer.Ordinal)
                {
                    ["playerName"] = playerSubmittedTooManyWordsMatch.Groups["playerName"].Value,
                });
        }

        return Create(
            "backend.fallback",
            message,
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["message"] = message,
            });
    }

    private static LocalizedMessageDto Create(string key, string fallback, IReadOnlyDictionary<string, string>? parameters = null)
        => new(
            key,
            parameters is null
                ? new Dictionary<string, string>(StringComparer.Ordinal)
                : new Dictionary<string, string>(parameters, StringComparer.Ordinal),
            fallback);

    [GeneratedRegex(@"^Exactly (?<requiredCount>\d+) words are required\.$", RegexOptions.CultureInvariant)]
    private static partial Regex ExactWordsRequiredRegex();

    [GeneratedRegex(@"^(?<playerName>.+) still needs (?<missingCount>\d+) more (?<noun>word|words)\.$", RegexOptions.CultureInvariant)]
    private static partial Regex PlayerNeedsWordsRegex();

    [GeneratedRegex(@"^(?<playerName>.+) has submitted more than the allowed number of words\.$", RegexOptions.CultureInvariant)]
    private static partial Regex PlayerSubmittedTooManyWordsRegex();
}
