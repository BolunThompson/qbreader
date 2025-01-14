// Functions and variables used in both the tossup and bonus pages.

/**
 * An array of random questions.
 * We get 20 random questions at a time so we don't have to make an HTTP request between every question.
 */
let randomQuestions = [];
let maxPacketNumber = 24;

/**
 * @param {String} answerline
 * @param {String} givenAnswer
 * @returns {Promise<[ "accept" | "prompt" | "reject", String | null ]>} [directive, directedPrompt]
 */
async function checkAnswer(answerline, givenAnswer) {
    return await fetch(`/api/check-answer?answerline=${encodeURIComponent(answerline)}&givenAnswer=${encodeURIComponent(givenAnswer)}`)
        .then(response => response.json());
}


/**
 * @param {String} setName - The name of the set (e.g. "2021 ACF Fall").
 * @param {String} packetNumber - The packet number of the set.
 * @return {Promise<Array<JSON>>} An array containing the bonuses.
 */
async function getBonuses(setName, packetNumber) {
    if (setName === '') {
        return [];
    }

    return await fetch(`/api/packet-bonuses?&setName=${encodeURIComponent(setName)}&packetNumber=${encodeURIComponent(packetNumber)}`)
        .then(response => response.json())
        .then(data => data.bonuses);
}


/**
 * @param {String} setName - The name of the set (e.g. "2021 ACF Fall").
 * @param {String} packetNumber - The packet number of the set.
 * @return {Promise<{tossups: Array<JSON>, bonuses: Array<JSON>}>} An array containing the questions.
 */
async function getPacket(setName, packetNumber) {
    if (setName === '') {
        return { tossups: [], bonuses: [] };
    }
    return await fetch(`/api/packet?&setName=${encodeURIComponent(setName)}&packetNumber=${encodeURIComponent(packetNumber)}`).then(response => response.json());
}


async function loadRandomQuestions(questionType, difficulties = [], categories = [], subcategories = []) {
    const [minYear, maxYear] = document.getElementById('year-range').innerHTML.split('-').map(x => parseInt(x));

    randomQuestions = await fetch('/api/random-question', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            questionType,
            difficulties,
            categories,
            subcategories,
            number: 20,
            minYear,
            maxYear,
        })
    }).then(response => response.json())
        .then(questions => {
            if (questionType === 'tossup') {
                for (let i = 0; i < questions.length; i++) {
                    if (Object.prototype.hasOwnProperty.call(questions[i], 'formatted_answer'))
                        questions[i].answer = questions[i].formatted_answer;
                }
            } else if (questionType === 'bonus') {
                for (let i = 0; i < questions.length; i++) {
                    if (Object.prototype.hasOwnProperty.call(questions[i], 'formatted_answers'))
                        questions[i].answers = questions[i].formatted_answers;
                }
            }

            return questions;
        });
}


async function getRandomQuestion(questionType, difficulties = [], categories = [], subcategories = []) {
    if (randomQuestions.length === 0) {
        await loadRandomQuestions(questionType, difficulties, categories, subcategories);
    }

    const randomQuestion = randomQuestions.pop();

    // Begin loading the next batch of questions (asynchronously)
    if (randomQuestions.length === 0) {
        loadRandomQuestions(questionType, difficulties, categories, subcategories);
    }

    return randomQuestion;
}

/**
 * @param {String} setName - The name of the set (e.g. "2021 ACF Fall").
 * @param {String} packetNumber - The packet number of the set.
 * @return {Promise<Array<JSON>>} An array containing the tossups.
 */
async function getTossups(setName, packetNumber) {
    if (setName === '') {
        return [];
    }
    return await fetch(`/api/packet-tossups?&setName=${encodeURIComponent(setName)}&packetNumber=${encodeURIComponent(packetNumber)}`)
        .then(response => response.json())
        .then(data => data.tossups);
}


/**
 * Increases or decreases a session storage item by a certain amount.
 * @param {String} item - The name of the sessionStorage item.
 * @param {Number} x - The amount to increase/decrease the sessionStorage item.
 */
function shift(item, x) {
    sessionStorage.setItem(item, parseFloat(sessionStorage.getItem(item)) + x);
}


/**
 * Initizalizes all variables (called when the user presses the start button).
 * @param {Boolean} selectBySetName - Whether or not the user is selecting by set name.
 * @returns {Promsie<Boolean>} Whether or not the function was successful.
 */
function start(selectBySetName) {
    setName = document.getElementById('set-name').value.trim();
    if (setName.length === 0 && selectBySetName) {
        alert('Please enter a set name.');
        return false;
    }

    document.getElementById('options').classList.add('d-none');
    document.getElementById('toggle-options').disabled = false;

    packetNumbers = rangeToArray(document.getElementById('packet-number').value.trim(), maxPacketNumber);
    packetNumber = packetNumbers[0];

    questionNumber = document.getElementById('question-number').value;
    if (questionNumber == '') questionNumber = '1';  // default = 1
    questionNumber = parseInt(questionNumber) - 2;

    document.getElementById('next').disabled = false;
    document.getElementById('next').innerHTML = 'Skip';

    return true;
}


document.querySelectorAll('#categories input').forEach(input => {
    input.addEventListener('click', function (event) {
        this.blur();
        validCategories = JSON.parse(localStorage.getItem('validCategories'));
        validSubcategories = JSON.parse(localStorage.getItem('validSubcategories'));
        [validCategories, validSubcategories] = updateCategory(input.id, validCategories, validSubcategories);
        loadCategoryModal(validCategories, validSubcategories);
        localStorage.setItem('validCategories', JSON.stringify(validCategories));
        localStorage.setItem('validSubcategories', JSON.stringify(validSubcategories));
    });
});


document.querySelectorAll('#subcategories input').forEach(input => {
    input.addEventListener('click', function (event) {
        this.blur();
        validSubcategories = updateSubcategory(input.id, validSubcategories);
        loadCategoryModal(validCategories, validSubcategories);
        localStorage.setItem('validSubcategories', JSON.stringify(validSubcategories));
    });
});


document.getElementById('set-name').addEventListener('change', async function (event) {
    // make border red if set name is not in set list
    if (SET_LIST.includes(this.value) || this.value.length === 0) {
        this.classList.remove('is-invalid');
    } else {
        this.classList.add('is-invalid');
    }
    maxPacketNumber = await getNumPackets(this.value);
    if (this.value === '' || maxPacketNumber > 0) {
        document.getElementById('packet-number').placeholder = `Packet Numbers (1-${maxPacketNumber})`;
    } else {
        document.getElementById('packet-number').placeholder = 'Packet Numbers';
    }
});


document.getElementById('toggle-select-by-set-name').addEventListener('click', function () {
    if (this.checked) {
        document.getElementById('difficulty-settings').classList.add('d-none');
        document.getElementById('set-settings').classList.remove('d-none');
        localStorage.setItem('selectBySetName', 'true');
    } else {
        document.getElementById('difficulty-settings').classList.remove('d-none');
        document.getElementById('set-settings').classList.add('d-none');
        localStorage.setItem('selectBySetName', 'false');
    }
});

if (localStorage.getItem('selectBySetName') === 'false') {
    document.getElementById('toggle-select-by-set-name').checked = false;
    document.getElementById('difficulty-settings').classList.remove('d-none');
    document.getElementById('set-settings').classList.add('d-none');
}
