"""
Undo/Redo command classes for canvas operations.
"""
from PyQt5.QtWidgets import QUndoCommand


class AddCommand(QUndoCommand):
    def __init__(self, canvas, component, pos):
        super().__init__()
        self.canvas = canvas
        self.component = component
        self.component.move(pos)
        self.setText(f"Add {component.config.get('component', 'Component')}")

    def redo(self):
        if self.component not in self.canvas.components:
            self.canvas.components.append(self.component)
            self.component.show()
            self.canvas.update()

    def undo(self):
        if self.component in self.canvas.components:
            self.canvas.components.remove(self.component)
            self.component.hide()
            self.canvas.update()

class AddConnectionCommand(QUndoCommand):
    def __init__(self, canvas, connection):
        super().__init__()
        self.canvas = canvas
        self.connection = connection
        self.setText("Add Connection")

    def redo(self):
        if self.connection not in self.canvas.connections:
            self.canvas.connections.append(self.connection)
            self.canvas.update()

    def undo(self):
        if self.connection in self.canvas.connections:
            self.canvas.connections.remove(self.connection)
            self.canvas.update()

class DeleteCommand(QUndoCommand):
    def __init__(self, canvas, components, connections):
        super().__init__()
        self.canvas = canvas
        self.components = components
        self.connections = connections
        self.setText(f"Delete {len(components)} items")

    def redo(self):
        for conn in self.connections:
            if conn in self.canvas.connections:
                self.canvas.connections.remove(conn)
        for comp in self.components:
            if comp in self.canvas.components:
                self.canvas.components.remove(comp)
                comp.hide()
        self.canvas.update()

    def undo(self):
        for comp in self.components:
            if comp not in self.canvas.components:
                self.canvas.components.append(comp)
                comp.show()
        for conn in self.connections:
            if conn not in self.canvas.connections:
                self.canvas.connections.append(conn)
        self.canvas.update()

class MoveCommand(QUndoCommand):
    def __init__(self, component, old_pos, new_pos):
        super().__init__()
        self.component = component
        self.old_pos = old_pos
        self.new_pos = new_pos
        self.setText(f"Move {component.config.get('component', 'Component')}")

    def redo(self):
        self.component.move(self.new_pos)
        self.component.parentWidget().update()

    def undo(self):
        self.component.move(self.old_pos)
        self.component.parentWidget().update()
