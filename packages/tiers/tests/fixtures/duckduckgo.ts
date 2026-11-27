export const DUCKDUCKGO_ANOMALY_CHALLENGE = `<!DOCTYPE html>
<html lang="en">
<head>
    <title>DuckDuckGo</title>
</head>
<body>
    <center id="lite_wrapper">
        <iframe name="ifr" width="0" height="0" border="0" class="hidden"></iframe>
        <form id="challenge-form" action="//duckduckgo.com/anomaly.js?sv=html&cc=sre&st=1788811733&gk=d4cd0dabcf4caa22ad92fab40844c786" method="POST">
            <div class="anomaly-modal__mask">
                <div class="anomaly-modal__modal is-ie" data-testid="anomaly-modal">
                    <div class="anomaly-modal__controls">
                        <button name="challenge-submit" class="btn btn--primary anomaly-modal__submit js-anomaly-modal-submit" form="challenge-form" value="d4cd0dabcf4caa22ad92fab40844c786">Submit</button>
                    </div>
                </div>
            </div>
        </form>
    </center>
</body>
</html>`

export const DUCKDUCKGO_SEARCH_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
    <title>test at DuckDuckGo</title>
</head>
<body>
    <div id="links" class="results">
        <div class="result results_links results_links_deep highlight_result">
            <a class="result__url" href="https://example.com">example.com</a>
            <h2 class="result__title">
                <a class="result__a" href="https://example.com">Example Domain</a>
            </h2>
        </div>
    </div>
</body>
</html>`
