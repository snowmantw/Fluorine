
self.app ?= {}
self.app.Template =
    'queue-block':
     """
        <div class="queue-block">
            <div class="content"><%= content %></div>
            <div class="date"><%= date  %></div>
        </div>
     """
