
self.app ?= {}
self.app.Template =
    'queue-block':
     """
        <div class="queue-block">
            <div class="menubar"><%= buttons %></div>
            <div class="content"><%= content %></div>
            <div class="date"><%= date  %></div>
        </div>
     """
    ,'queue-block-menu-button':
     """
        <span class="button <%= type %>"></span>
     """
